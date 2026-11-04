import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { BoardView } from "@/components/BoardView";
import { Pickers } from "@/components/Pickers";
import { db } from "@/lib/db";
import { loadBoardProps, recordBoardViews } from "@/lib/load-board";
import { DEFAULT_BOARD } from "@/lib/site";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Pick a board", "Choose a city and a category. Surat · Cafes is one board; Mumbai · Gyms is another."],
  ["See the price to pass", "Every spot shows what it costs to move up: the total above you, minus yours, plus ₹100. The smallest bid is ₹100."],
  ["Pay once", "Card, wallet or UPI, in rupees. Bids are final and add to the listing's total."],
  ["The board re-ranks", "The new order appears once the payment is confirmed, and a receipt goes to your email."],
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const LIVE_BOARD = { active: true, category: { active: true, banned: false } };

/** Every active city with the categories it has boards for. */
async function openBoards() {
  const cities = await db.city.findMany({
    where: { active: true, boards: { some: LIVE_BOARD } },
    orderBy: { name: "asc" },
    include: {
      boards: {
        where: LIVE_BOARD,
        select: { category: { select: { name: true, slug: true } } },
        orderBy: { category: { name: "asc" } },
      },
    },
  });
  return cities.map((c) => ({
    name: c.name,
    slug: c.slug,
    categories: [...new Map(c.boards.map((b) => [b.category.slug, b.category])).values()],
  }));
}

export default async function Home() {
  const [board, cities] = await Promise.all([loadBoardProps(DEFAULT_BOARD.city, DEFAULT_BOARD.category, "ALL_TIME"), openBoards()]);
  if (board) await recordBoardViews(board, (await headers()).get("user-agent") ?? "");
  const categoryCount = new Set(cities.flatMap((c) => c.categories.map((k) => k.slug))).size;

  return (
    <>
      <div className="inner board-page">
        {board ? (
          <Suspense>
            <BoardView {...board} pickers={<Pickers citySlug={board.slugs.city} categorySlug={board.slugs.category} />} />
          </Suspense>
        ) : (
          <p className="board-empty">No boards yet. Run the seed script to create the launch boards.</p>
        )}
      </div>

      <section className="home-section" id="how" aria-labelledby="how-title">
        <div className="inner">
          <div className="home-head">
            <p className="eyebrow-lg">How ranking works</p>
            <h2 className="h2" id="how-title">
              The biggest total ranks first. That&apos;s the whole rule.
            </h2>
            <p className="lead">Each city and category is its own board, so a small board like Surat · Cafes can be topped for a few hundred rupees.</p>
          </div>
          <ol className="home-steps">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="card">
                <span className="home-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="h3">{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-section" id="cities" aria-labelledby="cities-title">
        <div className="inner">
          <div className="home-head">
            <p className="eyebrow-lg">Open boards</p>
            <h2 className="h2" id="cities-title">
              {plural(cities.length, "city", "cities")}, {plural(categoryCount, "category", "categories")}
            </h2>
            <p className="lead">More cities open as their boards fill.</p>
          </div>
          <ul className="home-cities">
            {cities.map((c) => (
              <li key={c.slug} className="card">
                <h3 className="home-city">{c.name}</h3>
                <p className="home-city-boards">
                  {c.categories.map((k, i) => (
                    <span key={k.slug}>
                      {i > 0 && "· "}
                      <Link href={`/${c.slug}/${k.slug}`} aria-label={`${c.name} ${k.name}`}>
                        {k.name}
                      </Link>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section" id="owners" aria-labelledby="owners-title">
        <div className="inner home-owners">
          <div>
            <p className="eyebrow-lg">For business owners</p>
            <h2 className="h2" id="owners-title">
              Verify your business, no account needed
            </h2>
            <p className="lead">
              Prove you run the business through your website, Instagram or Facebook, and get a Verified badge on every board. To
              claim a spot, paste your link in the bar at the top of any board and pay. You&apos;re live as soon as it&apos;s confirmed.
            </p>
            <Link className="btn btn-primary" href="/add">
              Add your business free
            </Link>
          </div>
          <ul className="home-methods">
            <li className="card card-sm">
              <b>Website</b>
              <p>Add a meta tag or a small text file. Checked automatically.</p>
            </li>
            <li className="card card-sm">
              <b>Instagram or Facebook</b>
              <p>Put your code in your bio. Checked automatically, or by our team within a day.</p>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
