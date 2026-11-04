-- CreateEnum
CREATE TYPE "BoardType" AS ENUM ('ALL_TIME', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'LIVE', 'REJECTED', 'FROZEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BIDDER', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "Gateway" AS ENUM ('RAZORPAY', 'STRIPE', 'MOCK');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('VIEW', 'CLICK_WEBSITE', 'CLICK_INSTAGRAM', 'CLICK_FACEBOOK', 'CALL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "BoardType" NOT NULL DEFAULT 'ALL_TIME',
    "topN" INTEGER NOT NULL DEFAULT 7,
    "step" INTEGER NOT NULL DEFAULT 1000,
    "minBid" INTEGER NOT NULL DEFAULT 1000,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "phone" TEXT,
    "googlePlaceId" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,
    "ownerUserId" TEXT,
    "submitterEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'BIDDER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "userId" TEXT,
    "guestEmail" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "gateway" "Gateway" NOT NULL,
    "gatewayRef" TEXT NOT NULL,
    "gatewayPaymentId" TEXT,
    "fees" INTEGER,
    "tax" INTEGER,
    "invoiceNo" TEXT,
    "webhookVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "sessionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reporterContact" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Board_cityId_categoryId_type_key" ON "Board"("cityId", "categoryId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Period_boardId_startsAt_key" ON "Period"("boardId", "startsAt");

-- CreateIndex
CREATE INDEX "Listing_boardId_status_idx" ON "Listing"("boardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_boardId_normalizedName_key" ON "Listing"("boardId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Bid_periodId_status_idx" ON "Bid"("periodId", "status");

-- CreateIndex
CREATE INDEX "Bid_listingId_status_idx" ON "Bid"("listingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bidId_key" ON "Payment"("bidId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_invoiceNo_key" ON "Payment"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gateway_gatewayRef_key" ON "Payment"("gateway", "gatewayRef");

-- CreateIndex
CREATE INDEX "Event_listingId_type_createdAt_idx" ON "Event"("listingId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
