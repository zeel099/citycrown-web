import Link from "next/link";
import { db } from "@/lib/db";
import { liveCounts } from "@/lib/visits";
import { LiveStats } from "./LiveStats";
import { SiteNav } from "./SiteNav";

export async function SiteHeader() {
  const [counts, cities] = await Promise.all([liveCounts(), db.city.findMany({ where: { active: true }, select: { slug: true } })]);
  return (
    <header className="inner site-header">
      <div className="site-header-start">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">#1</span>
          <span className="brand-name">Best in the City</span>
        </Link>
        <LiveStats initial={counts} />
      </div>
      <SiteNav cities={cities.map((c) => c.slug)} />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <p>
          <b>Best in the City</b> · Order on every board is set by payment, not by quality or reviews. Every ranked entry is
          sponsored. Bids are non-refundable.
        </p>
        <p>Payments by card, wallet and UPI.</p>
      </div>
    </footer>
  );
}
