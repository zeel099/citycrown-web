// Refreshes Google ratings on listings that have a Place ID (FR-BRD-09).
// Run daily, e.g. from cron:  npx tsx scripts/refresh-google-ratings.ts
// Needs DATABASE_URL and GOOGLE_PLACES_API_KEY (read from .env when present).

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file; use the environment as is.
  }
  // Imported after the env is loaded so the database client sees DATABASE_URL.
  const { db } = await import("../src/lib/db");
  const { refreshGoogleRatings } = await import("../src/lib/google-places");
  try {
    const { places, updated, failed } = await refreshGoogleRatings(console.log);
    console.log(`Checked ${places} places, updated ${updated} listings, ${failed} failed.`);
    if (failed) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
