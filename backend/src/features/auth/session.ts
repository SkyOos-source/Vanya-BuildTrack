import { createHash, randomBytes } from "node:crypto";
import type { AccountRole } from "../../data/store";
import { prisma } from "../../prisma";

export type AuthenticatedSession = { name: string; email: string; role: AccountRole };

const accessTokenLifetimeMs = 60 * 60 * 1000;
const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const accessTokens = new Map<string, { user: AuthenticatedSession; expiresAt: number }>();

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function issueAccessToken(user: AuthenticatedSession) {
  const now = Date.now();
  for (const [token, session] of accessTokens) {
    if (session.expiresAt <= now) accessTokens.delete(token);
  }
  const accessToken = randomBytes(32).toString("base64url");
  accessTokens.set(accessToken, { user, expiresAt: now + accessTokenLifetimeMs });
  return accessToken;
}

export async function createSession(user: AuthenticatedSession) {
  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + refreshTokenLifetimeMs);
  await prisma.$executeRaw`
    INSERT INTO "RefreshToken" ("tokenHash", "userJson", "expiresAt")
    VALUES (${hashToken(refreshToken)}, ${JSON.stringify(user)}, ${expiresAt})
  `;
  return {
    accessToken: issueAccessToken(user),
    refreshToken,
    expiresIn: accessTokenLifetimeMs / 1000
  };
}

export function authenticateBearerHeader(authorization?: string): AuthenticatedSession | undefined {
  const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
  if (!token) return undefined;
  const session = accessTokens.get(token);
  if (!session) return undefined;
  if (session.expiresAt <= Date.now()) {
    accessTokens.delete(token);
    return undefined;
  }
  return session.user;
}

export async function rotateRefreshToken(token: string) {
  if (!/^[A-Za-z0-9_-]{64}$/.test(token)) return undefined;
  const tokenHash = hashToken(token);
  const now = new Date();
  const rows = await prisma.$queryRaw<Array<{ userJson: string; expiresAt: Date }>>`
    SELECT "userJson", "expiresAt" FROM "RefreshToken" WHERE "tokenHash" = ${tokenHash}
  `;
  const stored = rows[0];
  if (!stored) return undefined;
  if (new Date(stored.expiresAt) <= now) {
    await prisma.$executeRaw`DELETE FROM "RefreshToken" WHERE "tokenHash" = ${tokenHash}`;
    return undefined;
  }

  let user: AuthenticatedSession;
  try {
    const parsed: unknown = JSON.parse(stored.userJson);
    if (!parsed || typeof parsed !== "object") return undefined;
    const value = parsed as Partial<AuthenticatedSession>;
    if (typeof value.name !== "string" || typeof value.email !== "string" ||
      (value.role !== "owner" && value.role !== "employee" && value.role !== "client")) return undefined;
    user = { name: value.name, email: value.email, role: value.role };
  } catch {
    return undefined;
  }

  const nextRefreshToken = randomBytes(48).toString("base64url");
  const rotated = await prisma.$transaction(async (transaction) => {
    const deleted = await transaction.$executeRaw`
      DELETE FROM "RefreshToken" WHERE "tokenHash" = ${tokenHash} AND "expiresAt" > ${now}
    `;
    if (deleted !== 1) return false;
    await transaction.$executeRaw`
      INSERT INTO "RefreshToken" ("tokenHash", "userJson", "expiresAt")
      VALUES (
        ${hashToken(nextRefreshToken)},
        ${JSON.stringify(user)},
        ${new Date(Date.now() + refreshTokenLifetimeMs)}
      )
    `;
    await transaction.$executeRaw`DELETE FROM "RefreshToken" WHERE "expiresAt" <= ${now}`;
    return true;
  });
  if (!rotated) return undefined;
  return {
    user,
    accessToken: issueAccessToken(user),
    refreshToken: nextRefreshToken,
    expiresIn: accessTokenLifetimeMs / 1000
  };
}

export async function revokeTokens(authorization?: string, refreshToken?: string) {
  const accessToken = authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
  if (accessToken) accessTokens.delete(accessToken);
  if (refreshToken && /^[A-Za-z0-9_-]{64}$/.test(refreshToken)) {
    await prisma.$executeRaw`DELETE FROM "RefreshToken" WHERE "tokenHash" = ${hashToken(refreshToken)}`;
  }
}
