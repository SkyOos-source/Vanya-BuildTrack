CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "AppState" (
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    CONSTRAINT "AppState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
    "tokenHash" TEXT NOT NULL,
    "userJson" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "ClientLoginQuota" (
    "email" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "loginCount" INTEGER NOT NULL,
    CONSTRAINT "ClientLoginQuota_pkey" PRIMARY KEY ("email")
);

CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
