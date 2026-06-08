-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "activeConnectionId" TEXT,
    "envHidden" BOOLEAN NOT NULL DEFAULT false,
    "envOverrideJson" TEXT
);
