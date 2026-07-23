ALTER TABLE "User"
ADD COLUMN "universeVisibility" TEXT NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN "publicSlug" TEXT,
ADD COLUMN "universePublishedAt" TIMESTAMP(3),
ADD COLUMN "universeHiddenAt" TIMESTAMP(3),
ADD COLUMN "universeHiddenReason" TEXT;

CREATE TABLE "UniverseReport" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    CONSTRAINT "UniverseReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UniverseBlock" (
    "userId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UniverseBlock_pkey" PRIMARY KEY ("userId", "blockedUserId")
);

CREATE UNIQUE INDEX "User_publicSlug_key" ON "User"("publicSlug");
CREATE UNIQUE INDEX "UniverseReport_reporterUserId_targetUserId_key" ON "UniverseReport"("reporterUserId", "targetUserId");
CREATE INDEX "UniverseReport_status_createdAt_idx" ON "UniverseReport"("status", "createdAt");
CREATE INDEX "UniverseReport_targetUserId_idx" ON "UniverseReport"("targetUserId");
CREATE INDEX "UniverseReport_resolvedById_idx" ON "UniverseReport"("resolvedById");
CREATE INDEX "UniverseBlock_blockedUserId_idx" ON "UniverseBlock"("blockedUserId");

ALTER TABLE "UniverseReport" ADD CONSTRAINT "UniverseReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniverseReport" ADD CONSTRAINT "UniverseReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniverseReport" ADD CONSTRAINT "UniverseReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UniverseBlock" ADD CONSTRAINT "UniverseBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniverseBlock" ADD CONSTRAINT "UniverseBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
