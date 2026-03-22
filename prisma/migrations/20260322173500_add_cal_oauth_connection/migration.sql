-- CreateTable
CREATE TABLE "CalConnection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "calUserId" INTEGER NOT NULL,
    "calUsername" TEXT NOT NULL,
    "calName" TEXT NOT NULL,
    "calAvatarUrl" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalConnection_calUserId_key" ON "CalConnection"("calUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CalConnection_userId_key" ON "CalConnection"("userId");

-- AddForeignKey
ALTER TABLE "CalConnection" ADD CONSTRAINT "CalConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
