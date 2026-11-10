import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  completeInitialOwnerSetup,
  findOwnerAccount,
  isDemoRole,
  isInitialOwnerSetupRequired,
  people,
  readText,
  verifyClientCredential,
  verifyEmployeeCredential,
  verifyOwnerCredential
} from "../../data/store";
import { createSession, revokeTokens, rotateRefreshToken } from "./session";
import { failure, result } from "../shared";

let initialOwnerSetupCode: string | null = null;

export function createInitialOwnerSetupCode() {
  if (!isInitialOwnerSetupRequired()) return null;
  initialOwnerSetupCode = randomBytes(32).toString("hex");
  return initialOwnerSetupCode;
}

export function initialOwnerSetupStatus() {
  return { required: isInitialOwnerSetupRequired() };
}

export async function setupInitialOwners(body: unknown) {
  if (!isInitialOwnerSetupRequired()) return failure(409, "Initial owner setup is already complete.");
  if (!initialOwnerSetupCode) return failure(503, "Initial owner setup is not available. Check the server logs after restarting the application.");

  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const setupCode = typeof input.setupCode === "string" ? input.setupCode : "";
  const expectedCode = Buffer.from(initialOwnerSetupCode, "utf8");
  const suppliedCode = Buffer.from(setupCode, "utf8");
  if (expectedCode.length !== suppliedCode.length || !timingSafeEqual(expectedCode, suppliedCode)) {
    return failure(401, "The setup code is invalid. Check the server logs and try again.");
  }

  if (!Array.isArray(input.owners) || input.owners.length !== 2) {
    return failure(400, "Provide details for both owner accounts.");
  }
  const owners: Array<{ email: string; name: string; password: string }> = [];
  for (const value of input.owners) {
    if (!value || typeof value !== "object") return failure(400, "Each owner account must include a name, email, and password.");
    const account = value as Record<string, unknown>;
    const name = readText(account.name);
    const email = readText(account.email)?.toLowerCase();
    const password = typeof account.password === "string" ? account.password : "";
    if (!name || name.length > 100 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return failure(400, "Enter a valid name and email address for each owner.");
    }
    if (password.length < 12 || password.length > 256 || !password.trim()) {
      return failure(400, "Each owner password must be at least 12 characters.");
    }
    owners.push({ email, name, password });
  }
  if (owners[0].email === owners[1].email) return failure(400, "Owner email addresses must be different.");

  const completed = await completeInitialOwnerSetup(owners);
  if (!completed) return failure(409, "Initial owner setup has already been completed. Refresh the page and sign in.");
  initialOwnerSetupCode = null;
  return result({ status: "ok" });
}

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
