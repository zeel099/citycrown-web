import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CityMenu } from "@/components/CityMenu";
import { Avatar } from "@/components/board/Avatar";
import { timeAgo } from "@/lib/board-view";
import { cityCategories } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { cityForPage } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city?: string[] }> };

const businesses = (n: number) => `${n.toLocaleString("en-IN")} ${n === 1 ? "business" : "businesses"}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await cityForPage((await params).city);
  if (!page) return {};
  return {
    title: `Categories in ${page.city.name}`,
    description: `Every category in ${page.city.name} has its own ranking by total bids. See who leads each one.`,
  };
}

/** Every category in a city with the top of its All-time board, led by the most active ones today. */
export default async function CategoriesPage({ params }: Props) {
  const page = await cityForPage((await params).city);
  if (!page) notFound();
  const { city, cities } = page;
  const { cards, hottest } = await cityCategories(city);
  const money = (minor: number) => formatMoney(minor, city.currency);

  return (
    <div className="inner page">
      <div className="page-head">
        <h1 className="h1 page-title">Categories</h1>
        <CityMenu cities={cities} current={city.slug} href={(slug) => `/categories/${slug}`} />
      </div>
      <p className="lead page-lead">Every category in {city.name} has its own ranking. Pick one to see who leads it.</p>

      {hottest.length > 0 && (
        <section className="hot" aria-labelledby="hot-title">
          <h2 className="hot-title" id="hot-title">
            <span className="hot-dot" aria-hidden="true" />
            Most active categories
          </h2>
          <p className="hot-lead">Where ranks are being claimed right now, and who holds the top spot.</p>
          <ol className="hot-list">
            {hottest.map((c, i) => {
              const leader = c.top[0];
              return (
                <li key={c.slug}>
                  <Link className="hot-card" href={c.href}>
                    <span className="hot-head">
                      <CategoryIcon slug={c.slug} />
                      <span>
                        <span className="hot-rank">#{i + 1}{i === 0 && " hottest"}</span>
                        <span className="hot-name">{c.name}</span>
                      </span>
                    </span>
                    <span className="hot-claims">
                      <span>
                        {c.claimsToday ? (
                          <>
                            <b>{c.claimsToday}</b> {c.claimsToday === 1 ? "claim" : "claims"} today
                          </>
                        ) : (
                          "No claims today"
                        )}
                      </span>
                      <span>{c.lastClaim && `last ${timeAgo(c.lastClaim)}`}</span>
                    </span>
                    {leader && (
                      <span className="hot-leader">
                        <Avatar avatar={leader.avatar} size="sm" />
                        <span className="hot-leader-name">
                          Leading <b>{leader.name}</b>
                        </span>
                        <span className="hot-leader-total">{money(leader.total)}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <ul className="category-grid">
        {cards.map((c) => (
          <li key={c.slug} className="category-card">
            <h2 className="category-card-title">
              <CategoryIcon slug={c.slug} />
              <Link href={c.href}>{c.name}</Link>
            </h2>
            {c.top.length ? (
              <ol className="category-top" aria-label={`Top of ${c.name}`}>
                {c.top.map((r) => (
                  <li key={r.id}>
                    <Link className="mini-row" href={c.href}>
                      <span className="mini-rank">#{r.rank}</span>
                      <Avatar avatar={r.avatar} size="sm" />
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-total">{money(r.total)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="category-empty">No bids yet. The first bid takes #1.</p>
            )}
            <p className="category-foot">
              <span>{businesses(c.listed)}</span>
              <Link href={c.href} aria-label={`See the ${c.name} board`}>
                See the board ›
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
