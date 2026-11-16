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

export function connectWorkspaceEvents(
  onMessage: (data: string) => void,
  onError: (error: unknown) => void
): AbortController {
  const controller = new AbortController();
  const reconnectDelay = () => new Promise<void>((resolve) => {
    const onAbort = () => {
      window.clearTimeout(timer);
      controller.signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const timer = window.setTimeout(() => {
      controller.signal.removeEventListener("abort", onAbort);
      resolve();
    }, 1500);
    controller.signal.addEventListener("abort", onAbort, { once: true });
  });

  const connect = async () => {
    while (!controller.signal.aborted) {
      try {
        const response = await apiFetch("/api/events", {
          headers: { Accept: "text/event-stream" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Real-time workspace connection failed (${response.status}).`);
        if (!response.body) throw new Error("Real-time workspace response has no stream body.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const data = frame.split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).replace(/^ /, ""))
              .join("\n");
            if (data) onMessage(data);
            boundary = buffer.indexOf("\n\n");
          }
        }
        if (!controller.signal.aborted) throw new Error("Real-time workspace connection ended.");
      } catch (error) {
        if (controller.signal.aborted) return;
        onError(error);
        await reconnectDelay();
      }
    }
  };
  void connect();
  return controller;
}
