// Saves board pictures and Instagram follower counts for live businesses that are missing them (e.g. listed before
// pictures existed, or whose picture couldn't be fetched at the time).
// Run with: npm run avatars:refresh
import { refreshProfile } from "../src/lib/avatars";
import { db } from "../src/lib/db";

async function main() {
  const listings = await db.listing.findMany({
    where: { status: "LIVE", isSeed: false, OR: [{ avatar: null }, { instagramUrl: { not: null }, instagramFollowers: null }] },
    select: { id: true, name: true, normalizedName: true, board: { select: { cityId: true, categoryId: true } } },
    orderBy: { createdAt: "asc" },
  });
  // A business is listed on each board of its city and category; refreshProfile covers them all at once.
  const businesses = new Map(listings.map((l) => [`${l.normalizedName}|${l.board.cityId}|${l.board.categoryId}`, l]));
  let saved = 0;
  for (const l of businesses.values()) {
    const ok = await refreshProfile(l.id);
    if (ok) saved++;
    console.log(`${ok ? "saved" : "none "}  ${l.name}`);
  }
  console.log(`Updated ${saved} of ${businesses.size} businesses missing a picture or follower count.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
