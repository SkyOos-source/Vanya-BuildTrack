CREATE TABLE "RefreshToken" (
    "tokenHash" TEXT NOT NULL PRIMARY KEY,
    "userJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
