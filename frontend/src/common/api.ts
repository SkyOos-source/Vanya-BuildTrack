import { clearAuthTokens, readAccessToken, readRefreshToken, saveAuthTokens } from "./data";

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = readRefreshToken();
  if (!refreshToken) return null;
  refreshInFlight = (async () => {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (response.status === 401) {
      clearAuthTokens();
      localStorage.removeItem("buildtrack-session");
      return null;
    }
    if (!response.ok) throw new Error(`Session refresh failed (${response.status}).`);
    const result = await response.json() as { accessToken?: string; refreshToken?: string };
    if (!result.accessToken || !result.refreshToken) throw new Error("Session refresh response did not include both tokens.");
    saveAuthTokens(result.accessToken, result.refreshToken);
    return result.accessToken;
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const baseRequest = input instanceof Request ? input.clone() : null;
  const originalHeaders = init?.headers ?? baseRequest?.headers;
  const fetchWithToken = (token: string | null) => {
    const headers = new Headers(originalHeaders);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const requestInit = { ...init, headers };
    return baseRequest
      ? fetch(new Request(baseRequest.clone(), requestInit))
      : fetch(input, requestInit);
  };
  const url = new URL(baseRequest?.url ?? input.toString(), window.location.href);
  const isAuthEndpoint = url.pathname.startsWith("/api/auth/");
  const accessToken = readAccessToken();
  const response = await fetchWithToken(accessToken);
  if (response.status !== 401 || isAuthEndpoint) return response;

  const currentToken = readAccessToken();
  if (currentToken && currentToken !== accessToken) return fetchWithToken(currentToken);
  const renewedToken = await refreshAccessToken();
  return renewedToken ? fetchWithToken(renewedToken) : response;
}
