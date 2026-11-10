import { findOwnerAccount, isDemoRole, people, readText, verifyClientCredential, verifyEmployeeCredential, verifyOwnerCredential } from "../../data/store";
import { createSession, revokeTokens, rotateRefreshToken } from "./session";
import { failure, result } from "../shared";

export async function login(body: any) {
  const email = readText(body?.email)?.toLowerCase() ?? "";
  const password = readText(body?.password) ?? "";
  const role: unknown = body?.role;
  if (!isDemoRole(role)) return failure(400, "Choose a valid account role.");
  const ownerLogin = role === "owner" && verifyOwnerCredential(email, password);
  const invitedEmployeeLogin = role === "employee" && verifyEmployeeCredential(email, password);
  const invitedClientLogin = role === "client" && verifyClientCredential(email, password);
  if (!ownerLogin && !invitedEmployeeLogin && !invitedClientLogin) {
    return failure(401, "Email or password is incorrect for this role.");
  }
  const invitedPerson = invitedEmployeeLogin || invitedClientLogin ? findPerson(email, role) : undefined;
  const account = invitedPerson ?? (ownerLogin ? findOwnerAccount(email) : undefined);
  if (!account) return failure(401, "Email or password is incorrect for this role.");
  const user = { name: account.name, email: account.email, role };
  return result({ user, ...await createSession(user) });
}

export async function refresh(body: any) {
  const refreshToken = readText(body?.refreshToken);
  if (!refreshToken) return failure(401, "A valid refresh token is required.");
  const session = await rotateRefreshToken(refreshToken);
  if (!session) return failure(401, "Refresh token is invalid or expired. Sign in again.");
  return result(session);
}

export const logout = async (authorization?: string, refreshToken?: string) => {
  await revokeTokens(authorization, refreshToken);
  return result({ status: "ok" });
};

function findPerson(email: string, role: "employee" | "client") {
  const personRole = role === "employee" ? "Site Engineer" : "Client";
  return people.find((person) => person.email.toLowerCase() === email && person.role === personRole);
}
