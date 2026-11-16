CREATE TABLE "AppState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL
);

CREATE TABLE "RefreshToken" (
    "tokenHash" TEXT NOT NULL PRIMARY KEY,
    "userJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ClientLoginQuota" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "loginCount" INTEGER NOT NULL
);

CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
