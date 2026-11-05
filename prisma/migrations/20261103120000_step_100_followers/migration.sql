-- AlterTable
ALTER TABLE "Board" ALTER COLUMN "step" SET DEFAULT 10000;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "followersCheckedAt" TIMESTAMP(3),
ADD COLUMN     "instagramFollowers" INTEGER;


-- Passing a listing costs at least ₹100 more than its total (was ₹10).
UPDATE "Board" SET "step" = 10000 WHERE "step" < 10000;
