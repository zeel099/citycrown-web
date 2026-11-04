-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'AWAITING_PAYMENT';

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Verification" DROP CONSTRAINT "Verification_userId_fkey";

-- DropIndex
DROP INDEX "Verification_listingId_userId_key";

-- AlterTable
ALTER TABLE "Board" ALTER COLUMN "minBid" SET DEFAULT 10000;

-- AlterTable
ALTER TABLE "Verification" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptKey" TEXT;

-- DropTable
DROP TABLE "LoginCode";

-- DropTable
DROP TABLE "Session";

-- DropEnum
DROP TYPE "LoginChannel";

-- CreateIndex
CREATE UNIQUE INDEX "Verification_listingId_key" ON "Verification"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptKey_key" ON "Payment"("receiptKey");

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Every bid is at least ₹100 (was ₹10).
UPDATE "Board" SET "minBid" = 10000 WHERE "minBid" < 10000;

-- Receipts open from an unguessable link now that there are no accounts.
UPDATE "Payment" SET "receiptKey" = md5(random()::text || id) || md5(random()::text) WHERE "invoiceNo" IS NOT NULL AND "receiptKey" IS NULL;
