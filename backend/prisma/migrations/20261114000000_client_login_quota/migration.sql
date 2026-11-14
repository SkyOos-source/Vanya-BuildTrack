CREATE TABLE IF NOT EXISTS "ClientLoginQuota" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "loginCount" INTEGER NOT NULL
);
