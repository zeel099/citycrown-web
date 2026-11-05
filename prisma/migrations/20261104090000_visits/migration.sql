-- Visitors per day and who is on the site now (header: "20 online · 2,849 visitors today").
CREATE TABLE "Visit" (
    "day" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("day","visitor")
);

CREATE INDEX "Visit_lastSeenAt_idx" ON "Visit"("lastSeenAt");
