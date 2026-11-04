-- CreateTable
CREATE TABLE "ListingAvatar" (
    "listingId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "type" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingAvatar_pkey" PRIMARY KEY ("listingId")
);

-- AddForeignKey
ALTER TABLE "ListingAvatar" ADD CONSTRAINT "ListingAvatar_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

