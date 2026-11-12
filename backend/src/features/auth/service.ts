import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  type AccountRole,
  completeInitialOwnerSetup,
  consumeClientLoginQuota,
  findOwnerAccount,
  isAccountRole,
  isInitialOwnerSetupRequired,
  ownerProfiles,
  people,
  readText,
  saveStore,
  verifyClientCredential,
  verifyEmployeeCredential,
  verifyOwnerCredential
} from "../../data/store";
import { createSession, revokeTokens, rotateRefreshToken } from "./session";
import { failure, result } from "../shared";

let initialOwnerSetupCode: string | null = null;
type LoginChallenge = { email: string; role: AccountRole; phone?: string; expiresAt: number; attempts: number };
const loginChallenges = new Map<string, LoginChallenge>();
const sentCodesByPhone = new Map<string, number[]>();
const challengeLifetimeMs = 10 * 60 * 1000;
const maxCodeAttempts = 5;

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
  const owners: Array<{ email: string; name: string; password: string; phone: string }> = [];
  for (const value of input.owners) {
    if (!value || typeof value !== "object") return failure(400, "Each owner account must include a name, email, and password.");
    const account = value as Record<string, unknown>;
    const name = readText(account.name);
    const email = readText(account.email)?.toLowerCase();
    const phone = normalizePhone(account.phone);
    const password = typeof account.password === "string" ? account.password : "";
    if (!name || name.length > 100 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return failure(400, "Enter a valid name and email address for each owner.");
    }
    if (!phone) return failure(400, "Enter a valid international phone number (+country code) for each owner.");
    if (password.length < 12 || password.length > 256 || !password.trim()) {
      return failure(400, "Each owner password must be at least 12 characters.");
    }
    owners.push({ email, name, password, phone });
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
  if (!isAccountRole(role)) return failure(400, "Choose a valid account role.");
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
  if (role === "client") {
    if (!await consumeClientLoginQuota(email)) {
      return failure(429, "Daily sign-in limit reached. Try again after 00:00 UTC.");
    }
    return result({ user, ...await createSession(user) });
  }
  if (!isMfaEnabled()) return result({ user, ...await createSession(user) });
  const phone = accountPhone(email, role);
  const challengeId = createLoginChallenge(email, role, phone ?? undefined);
  if (!phone) return result({ challengeId, phoneRequired: true });
  try {
    await sendTwilioCode(phone);
  } catch (error) {
    loginChallenges.delete(challengeId);
    console.error("Unable to send sign-in verification code:", error);
    return failure(smsErrorStatus(error), smsErrorMessage(error));
  }
  return result({ challengeId, phoneHint: maskPhone(phone) });
}

export async function sendLoginCode(body: unknown) {
  if (!isMfaEnabled()) return failure(403, "SMS two-step verification is currently disabled.");
  const input = asRecord(body);
  const challengeId = readText(input.challengeId) ?? "";
  const challenge = getLoginChallenge(challengeId);
  if (!challenge) return failure(401, "This sign-in attempt expired. Enter your password again.");
  const requestedPhone = input.phone === undefined ? challenge.phone : normalizePhone(input.phone);
  if (!requestedPhone) return failure(400, "Enter a valid international phone number (+country code).");
  if (challenge.phone && requestedPhone !== challenge.phone) {
    return failure(400, "Use the phone number already linked to this account.");
  }
  try {
    await sendTwilioCode(requestedPhone);
  } catch (error) {
    console.error("Unable to send sign-in verification code:", error);
    return failure(smsErrorStatus(error), smsErrorMessage(error));
  }
  challenge.phone = requestedPhone;
  return result({ challengeId, phoneHint: maskPhone(requestedPhone) });
}

export async function verifyLoginCode(body: unknown) {
  if (!isMfaEnabled()) return failure(403, "SMS two-step verification is currently disabled.");
  const input = asRecord(body);
  const challengeId = readText(input.challengeId) ?? "";
  const code = typeof input.code === "string" ? input.code.trim() : "";
  const challenge = getLoginChallenge(challengeId);
  if (!challenge) return failure(401, "This sign-in attempt expired. Enter your password again.");
  if (!challenge.phone) return failure(400, "Add a phone number before requesting a verification code.");
  if (!/^\d{4,10}$/.test(code)) return failure(400, "Enter the verification code from your text message.");
  let approved: boolean;
  try {
    approved = await checkTwilioCode(challenge.phone, code);
  } catch (error) {
    console.error("Unable to verify sign-in code:", error);
    return failure(smsErrorStatus(error), smsErrorMessage(error));
  }
  if (!approved) {
    challenge.attempts += 1;
    if (challenge.attempts === maxCodeAttempts) loginChallenges.delete(challengeId);
    return failure(401, challenge.attempts === maxCodeAttempts
      ? "Too many incorrect codes. Enter your password again to restart sign-in."
      : "That verification code is incorrect or expired.");
  }

  const user = completePhoneVerification(challenge);
  if (!user) {
    loginChallenges.delete(challengeId);
    return failure(401, "This account is no longer available. Contact your workspace owner.");
  }
  await saveStore();
  loginChallenges.delete(challengeId);
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

class SmsConfigurationError extends Error {}
class SmsRateLimitError extends Error {}

function isMfaEnabled(): boolean {
  return process.env.MFA_ENABLED?.trim().toLowerCase() === "true";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string" || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  const phone = value.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function accountPhone(email: string, role: AccountRole): string | null {
  if (role === "owner") return normalizePhone(ownerProfiles[email]?.phone);
  const personRole = role === "employee" ? "Site Engineer" : "Client";
  const person = people.find((item) => item.email.toLowerCase() === email && item.role === personRole);
  return normalizePhone(person?.phone);
}

function createLoginChallenge(email: string, role: AccountRole, phone?: string): string {
  const now = Date.now();
  for (const [id, challenge] of loginChallenges) {
    if (challenge.expiresAt <= now) loginChallenges.delete(id);
  }
  const challengeId = randomBytes(32).toString("base64url");
  loginChallenges.set(challengeId, { email, role, phone, expiresAt: now + challengeLifetimeMs, attempts: 0 });
  return challengeId;
}

function getLoginChallenge(id: string): LoginChallenge | undefined {
  const challenge = loginChallenges.get(id);
  if (challenge && challenge.expiresAt <= Date.now()) {
    loginChallenges.delete(id);
    return undefined;
  }
  return challenge;
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}

function smsErrorMessage(error: unknown): string {
  if (error instanceof SmsConfigurationError) {
    return "SMS verification is not configured. Set the Twilio Verify environment variables and try again.";
  }
  if (error instanceof SmsRateLimitError) return error.message;
  return "The SMS verification service is unavailable. Please try again shortly.";
}

function smsErrorStatus(error: unknown): number {
  return error instanceof SmsConfigurationError ? 503 : error instanceof SmsRateLimitError ? 429 : 502;
}

function twilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!accountSid || !authToken || !serviceSid) throw new SmsConfigurationError("Twilio Verify configuration is incomplete.");
  return { accountSid, authToken, serviceSid };
}

async function callTwilioVerify(endpoint: "Verifications" | "VerificationCheck", fields: Record<string, string>) {
  const { accountSid, authToken, serviceSid } = twilioCredentials();
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(10_000)
    }
  );
  if (!response.ok) {
    if (endpoint === "VerificationCheck" && response.status === 404) return { status: "pending" };
    throw new Error(`Twilio Verify returned HTTP ${response.status}.`);
  }
  return await response.json() as { status?: string };
}

async function sendTwilioCode(phone: string) {
  const now = Date.now();
  const recent = (sentCodesByPhone.get(phone) ?? []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  if (recent.length && now - recent[recent.length - 1] < 60 * 1000) {
    throw new SmsRateLimitError("A verification code was sent recently. Wait one minute and try again.");
  }
  if (recent.length >= 5) throw new SmsRateLimitError("Too many verification codes were requested. Try again in an hour.");
  await callTwilioVerify("Verifications", { To: phone, Channel: "sms" });
  sentCodesByPhone.set(phone, [...recent, now]);
}

async function checkTwilioCode(phone: string, code: string): Promise<boolean> {
  const result = await callTwilioVerify("VerificationCheck", { To: phone, Code: code });
  return result.status === "approved";
}

function completePhoneVerification(challenge: LoginChallenge) {
  const { email, role, phone } = challenge;
  if (!phone) return undefined;
  if (role === "owner") {
    const owner = findOwnerAccount(email);
    if (!owner) return undefined;
    const profile = ownerProfiles[owner.email] ??= { phone: "", image: "" };
    profile.phone = phone;
    profile.phoneVerified = true;
    return { name: owner.name, email: owner.email, role };
  }
  const personRole = role === "employee" ? "Site Engineer" : "Client";
  const person = people.find((item) => item.email.toLowerCase() === email && item.role === personRole);
  if (!person) return undefined;
  person.phone = phone;
  person.phoneVerified = true;
  return { name: person.name, email: person.email, role };
}
