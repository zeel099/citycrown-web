// Launch data from the FSD: Indian cities, 10 categories, free seed listings (FR-ADM-04).
// Sample bids and demo accounts are added outside production only, so boards and
// account pages don't look empty in development.
import crypto from "node:crypto";
import { PrismaClient, type BoardType } from "@prisma/client";
import { periodBounds } from "../src/lib/time";
import { normalizeName, slugify } from "../src/lib/slug";

const db = new PrismaClient();
const DEV = process.env.NODE_ENV !== "production";

// Pune and the other later cities open with boards but no listings yet (the "new city" empty state).
const india = (name: string, latitude: number, longitude: number, seedListings = false) =>
  ({ name, country: "IN", currency: "INR", timeZone: "Asia/Kolkata", latitude, longitude, seedListings });
const CITIES = [
  india("Surat", 21.1702, 72.8311, true),
  india("Ahmedabad", 23.0225, 72.5714, true),
  india("Mumbai", 19.076, 72.8777, true),
  india("Pune", 18.5204, 73.8567),
  // Metros and tech hubs (also added by the 20261103180000_more_cities migration).
  india("Delhi", 28.6315, 77.2167),
  india("Bengaluru", 12.9716, 77.5946),
  india("Hyderabad", 17.385, 78.4867),
  india("Chennai", 13.0827, 80.2707),
  india("Kolkata", 22.5726, 88.3639),
  india("Gurugram", 28.4595, 77.0266),
  india("Noida", 28.57, 77.321),
  india("Mohali", 30.7046, 76.7179),
  india("Chandigarh", 30.7333, 76.7794),
  india("Kochi", 9.9312, 76.2673),
  india("Indore", 22.7196, 75.8577),
  india("Jaipur", 26.9124, 75.7873),
];

const CATEGORIES: Record<string, string[]> = {
  Cafes: ["Brew Lane", "Tapi Roast Co.", "Chai & Chapter", "Little Filter", "Monsoon Beans", "The Kettle Room", "Third Shelf Cafe", "Cardamom Corner", "Steam Street"],
  Restaurants: ["Thali House 1952", "Ghee & Grain", "Coastline Kitchen", "Rasoi Republic", "Spice Ledger", "Mithas Dining", "Kesar Courtyard", "Banyan Table", "Saffron Lane"],
  Salons: ["Clip Theory", "Mirror Mirror Studio", "Fade District", "Mehendi & Co.", "Gloss Lab", "Shear Joy", "The Parlour Edit", "Bloom Hair Bar"],
  Gyms: ["Iron Ghat", "Pulse 24", "Lift Club", "Core Yard", "The Squat Rack", "Stride Fitness", "Dumbbell Den", "Kinetic House"],
  "T-shirts": ["Inkwell Tees", "Loom & Letter", "Printwala", "Plain Cotton Co.", "Graphic Gully", "Tee Theory", "Silk Thread Prints", "Block Print Bros"],
  // Added by the 20261103200000_more_categories migration.
  Bakeries: ["Crumb & Crust", "Butterfold Bakery", "The Proofing Room", "Rusk & Roll", "Golden Loaf", "Sourdough Street", "Bake Bazaar", "Little Oven Co."],
  "Sweet shops": ["Jalebi Junction", "Mithai Mahal", "Peda & Pista", "Barfi Bazaar", "Ladoo Darbar", "Rabdi Room", "Ghevar Ghar", "Halwa House"],
  Spas: ["Still Water Spa", "Lotus Calm", "Hammam House", "Neem Retreat", "Quiet Hours Spa", "Sandalwood Studio", "Ember Stone Spa", "Tulsi Touch Spa"],
  Boutiques: ["Thread Story", "Kurta Kraft", "Indigo Alley", "Zari Studio", "Drape & Dot", "Handloom Hive", "Chikan Corner", "Bandhani Bay"],
  "Pet shops": ["Paws & Whiskers", "The Barking Lot", "Tail Waggers", "Fur & Feather", "Kibble Corner", "Happy Hound", "Purrfect Pets", "Pet Pantry"],
};
const BANNED = ["Adult services", "Tobacco and vapes"];
const BOARD_TYPES: BoardType[] = ["ALL_TIME", "DAILY"];

// Deterministic pseudo-random so every reseed produces the same boards.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}
const hash = (key: string) => [...key].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) >>> 0;

async function main() {
  for (const name of [...Object.keys(CATEGORIES), ...BANNED]) {
    const banned = BANNED.includes(name);
    await db.category.upsert({ where: { slug: slugify(name) }, create: { name, slug: slugify(name), banned }, update: { banned } });
  }

  for (const { seedListings, ...c } of CITIES) {
    const city = await db.city.upsert({ where: { slug: slugify(c.name) }, create: { ...c, slug: slugify(c.name) }, update: {} });

    for (const [catName, names] of Object.entries(CATEGORIES)) {
      const category = await db.category.findUniqueOrThrow({ where: { slug: slugify(catName) } });
      for (const type of BOARD_TYPES) {
        const board = await db.board.upsert({
          where: { cityId_categoryId_type: { cityId: city.id, categoryId: category.id, type } },
          create: { cityId: city.id, categoryId: category.id, type },
          update: {},
        });
        if (!seedListings) continue;
        const rand = rng(hash(`${c.name}|${catName}|rating`));
        for (const [i, name] of names.entries()) {
          const slug = slugify(name);
          await db.listing.upsert({
            where: { boardId_normalizedName: { boardId: board.id, normalizedName: normalizeName(name) } },
            create: {
              boardId: board.id,
              name,
              normalizedName: normalizeName(name),
              status: "LIVE",
              isSeed: true,
              linkCheckOk: true,
              linkCheckedAt: new Date(),
              websiteUrl: i % 3 !== 1 ? `https://example.com/${slug}` : null,
              instagramUrl: i % 2 === 0 ? `https://instagram.com/${slug.replace(/-/g, "")}` : null,
              // Sample locations around the city centre for development; real owners give theirs.
              ...(DEV ? sampleLocation(c, `${catName}|${name}`) : {}),
              // Sample Google ratings for development; production fills these from Google Places.
              ...(DEV ? { googleRating: Math.round((4 + rand()) * 10) / 10, googleReviews: 20 + Math.round(rand() * 600) } : {}),
            },
            update: {},
          });
        }
        if (DEV) await sampleBids(board.id, type, c.timeZone, `${c.name}|${catName}|${type}`);
      }
    }
  }

  if (DEV) await demoAccounts();
  console.log("Seeded", await db.city.count(), "cities,", await db.board.count(), "boards,", await db.listing.count(), "listings");
}

async function sampleBids(boardId: string, type: BoardType, timeZone: string, key: string) {
  const period = await openPeriod(boardId, type, timeZone);
  if (await db.bid.count({ where: { periodId: period.id } })) return;

  const rand = rng(hash(key));
  const listings = await db.listing.findMany({ where: { boardId }, orderBy: { createdAt: "asc" } });
  const shuffled = listings.sort(() => rand() - 0.5).slice(0, listings.length - 2); // last two stay unranked
  let total = type === "ALL_TIME" ? 90000 + Math.round(rand() * 220000) : 12000 + Math.round(rand() * 38000);
  for (const [i, l] of shuffled.entries()) {
    const amount = Math.max(10000, Math.round(total / 1000) * 1000); // every bid is at least ₹100
    const confirmedAt = new Date(Date.now() - (i + 1) * 3600e3);
    const bid = await db.bid.create({
      data: { listingId: l.id, periodId: period.id, amount, currency: "INR", status: "CONFIRMED", confirmedAt, guestEmail: "sample@example.com" },
    });
    await db.payment.create({ data: { bidId: bid.id, gateway: "MOCK", gatewayRef: `seed_${bid.id}`, webhookVerifiedAt: confirmedAt } });
    total *= 0.58 + rand() * 0.3;
  }
}

async function openPeriod(boardId: string, type: BoardType, timeZone: string) {
  const { startsAt, endsAt } = periodBounds(type, new Date(), timeZone);
  return db.period.upsert({ where: { boardId_startsAt: { boardId, startsAt } }, create: { boardId, startsAt, endsAt }, update: {} });
}

/** Listings for a business on every board of its city and category (All-time and Today). */
async function listingsNamed(city: string, category: string, name: string) {
  return db.listing.findMany({
    where: { normalizedName: normalizeName(name), board: { city: { slug: slugify(city) }, category: { slug: slugify(category) } } },
    include: { board: true },
    orderBy: { board: { type: "asc" } },
  });
}

/**
 * Demo data for the account, verification and admin screens:
 * owner@example.com is the contact for two verified Surat cafes and three
 * verifications in progress; you@example.com has three paid bids with receipts.
 */
async function demoAccounts() {
  if (await db.user.findUnique({ where: { email: "owner@example.com" } })) return;

  const owner = await db.user.create({ data: { email: "owner@example.com", role: "OWNER" } });
  for (const name of ["Chai & Chapter", "Brew Lane"]) {
    const listings = await listingsNamed("Surat", "Cafes", name);
    for (const l of listings) {
      await db.listing.update({ where: { id: l.id }, data: { ownerUserId: owner.id, verifiedAt: new Date() } });
    }
    await db.verification.create({
      data: { listingId: listings[0].id, userId: owner.id, method: "WEBSITE", code: code(name), status: "VERIFIED", lastCheckedAt: new Date() },
    });
  }
  const inProgress = [
    { name: "Little Filter", method: "WEBSITE", status: "PENDING" },
    { name: "Third Shelf Cafe", method: "WEBSITE", status: "PENDING" },
    { name: "Monsoon Beans", method: "INSTAGRAM", status: "IN_REVIEW" },
  ] as const;
  for (const v of inProgress) {
    const [l] = await listingsNamed("Surat", "Cafes", v.name);
    await db.verification.create({
      data: {
        listingId: l.id,
        userId: owner.id,
        method: v.method,
        code: code(v.name),
        status: v.status,
        ...(v.status === "IN_REVIEW" ? { lastCheckedAt: new Date(), lastCheckNote: "Profile couldn't be read automatically" } : {}),
      },
    });
  }

  // you@example.com: three paid bids on Mumbai → Restaurants (All-time), each with a GST invoice.
  const bidder = await db.user.create({ data: { email: "you@example.com" } });
  const fy = financialYear(new Date());
  const paid = [
    { name: "Banyan Table", amount: 160000 },
    { name: "Kesar Courtyard", amount: 161000 },
    { name: "Mithas Dining", amount: 141000 },
  ];
  for (const [i, p] of paid.entries()) {
    const [l] = await listingsNamed("Mumbai", "Restaurants", p.name);
    const period = await openPeriod(l.boardId, l.board.type, "Asia/Kolkata");
    const confirmedAt = new Date(Date.now() - (paid.length - i) * 60e3);
    const bid = await db.bid.create({
      data: {
        listingId: l.id,
        periodId: period.id,
        userId: bidder.id,
        guestEmail: bidder.email,
        amount: p.amount,
        currency: "INR",
        status: "CONFIRMED",
        createdAt: confirmedAt,
        confirmedAt,
      },
    });
    await db.payment.create({
      data: {
        bidId: bid.id,
        gateway: "MOCK",
        gatewayRef: `seed_${bid.id}`,
        webhookVerifiedAt: confirmedAt,
        tax: p.amount - Math.round(p.amount / 1.18), // GST at 18%, included in the amount paid
        invoiceNo: `BITC/${fy}/${String(i + 1).padStart(6, "0")}`,
        receiptKey: crypto.randomBytes(24).toString("base64url"),
      },
    });
  }
  await db.invoiceCounter.upsert({ where: { fy }, create: { fy, last: paid.length }, update: { last: paid.length } });

  // A new listing waiting for moderation whose link check failed.
  const [ahmCafes] = await db.board.findMany({ where: { type: "ALL_TIME", city: { slug: "ahmedabad" }, category: { slug: "cafes" } } });
  await db.listing.create({
    data: {
      boardId: ahmCafes.id,
      name: "Sip & Stories Cafe",
      normalizedName: normalizeName("Sip & Stories Cafe"),
      instagramUrl: "https://instagram.com/sipandstories",
      submitterEmail: "owner@sipandstories.in",
      status: "PENDING",
      linkCheckOk: false,
      linkCheckNote: "instagram.com: unreachable",
      linkCheckedAt: new Date(),
    },
  });

  // An open report.
  const [fade] = await listingsNamed("Surat", "Salons", "Fade District");
  await db.report.create({ data: { listingId: fade.id, reason: "Fake or closed business: Closed since September" } });
}

/** A point within about 5 km of the city centre, the same for a business on every board. */
function sampleLocation(city: { name: string; latitude: number; longitude: number }, key: string) {
  // FNV-1a: `hash` above overflows for longer keys and would put every business on the same spot.
  let h = 2166136261;
  for (const ch of `${city.name}|${key}|location`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = rng(h >>> 0);
  return {
    latitude: Math.round((city.latitude + (rand() - 0.5) * 0.09) * 1e6) / 1e6,
    longitude: Math.round((city.longitude + (rand() - 0.5) * 0.09) * 1e6) / 1e6,
    address: `Sample address, ${city.name}`,
  };
}

/** Indian financial year label, April to March: November 2026 → "2627". */
function financialYear(at: Date) {
  const start = at.getMonth() >= 3 ? at.getFullYear() : at.getFullYear() - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

function code(seed: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = rng(hash(seed));
  return `BITC-${Array.from({ length: 8 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("")}`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
