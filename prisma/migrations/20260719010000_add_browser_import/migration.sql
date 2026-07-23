-- Keep automatically imported or directly added sites private until a user
-- explicitly asks for an official-site review.
ALTER TABLE "Site" ALTER COLUMN "status" SET DEFAULT 'UNLISTED';

ALTER TABLE "User" ADD COLUMN "initialImportAt" TIMESTAMP(3);
ALTER TABLE "UserSite" ADD COLUMN "browserFavorite" BOOLEAN NOT NULL DEFAULT false;
