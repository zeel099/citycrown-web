import Link from "next/link";
import { Avatar } from "@/components/board/Avatar";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatMoney } from "@/lib/money";
import { search } from "@/lib/search";
import { DEFAULT_BOARD } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search", description: "Find a business, city or category on every board." };

type Props = { searchParams: Promise<{ q?: string; city?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", city: from } = await searchParams;
  const query = q.trim();
  // The city the visitor came from (a slug), used in category links; anything else is ignored.
  const city = from && /^[a-z0-9-]{1,60}$/.test(from) ? from : undefined;
  const { businesses, cities, categories } = await search(query, city);
  const nothing = query.length >= 2 && !businesses.length && !cities.length && !categories.length;

  return (
    <div className="inner page search">
      <h1 className="h1 page-title">Search</h1>
      <form className="search-form" action="/search" role="search">
        <label className="visually-hidden" htmlFor="search-q">
          Business, Instagram handle, city or category
        </label>
        <input
          id="search-q"
          className="search-input"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Business name, @handle, city or category"
          autoFocus
          autoComplete="off"
          maxLength={80}
        />
        {city && <input type="hidden" name="city" value={city} />}
        <button type="submit" className="btn btn-primary search-btn">
          Search
        </button>
      </form>

      {query.length === 1 && <p className="page-note">Type at least two letters.</p>}
      {nothing && <p className="page-note">Nothing matches “{query}”. Try part of the name, or the business&apos;s Instagram handle.</p>}

      {(cities.length > 0 || categories.length > 0) && (
        <ul className="search-chips" aria-label="Cities and categories">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link href={`/categories/${c.slug}`}>{c.name}</Link>
            </li>
          ))}
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/${city ?? DEFAULT_BOARD.city}/${c.slug}`}>
                <CategoryIcon slug={c.slug} />
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {businesses.length > 0 && (
        <ol className="search-results" aria-label="Businesses">
          {businesses.map((b) => (
            <li key={b.id}>
              <Link className="search-hit" href={`/${b.city.slug}/${b.category.slug}`}>
                <Avatar avatar={b.avatar} size="sm" />
                <span className="search-hit-body">
                  <span className="search-hit-name">{b.name}</span>
                  <span className="search-hit-meta">
                    {b.city.name} · {b.category.name}
                  </span>
                </span>
                <span className="search-hit-rank">
                  {b.rank ? (
                    <>
                      <b>#{b.rank}</b> {formatMoney(b.total, b.currency)}
                    </>
                  ) : (
                    "No bids yet"
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
