-- AlterTable
ALTER TABLE "City" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Verification" ADD COLUMN     "pendingAddress" TEXT,
ADD COLUMN     "pendingLatitude" DOUBLE PRECISION,
ADD COLUMN     "pendingLongitude" DOUBLE PRECISION;


-- City centres for the launch cities (address search bias and the "is it in this city?" check).
UPDATE "City" SET "latitude" = 21.1702, "longitude" = 72.8311 WHERE "slug" = 'surat';
UPDATE "City" SET "latitude" = 23.0225, "longitude" = 72.5714 WHERE "slug" = 'ahmedabad';
UPDATE "City" SET "latitude" = 19.0760, "longitude" = 72.8777 WHERE "slug" = 'mumbai';
UPDATE "City" SET "latitude" = 18.5204, "longitude" = 73.8567 WHERE "slug" = 'pune';
