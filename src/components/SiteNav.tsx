"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const PAGES = [
  ["Daily", "/daily"],
  ["Categories", "/categories"],
  ["About", "/about"],
  ["Rules", "/rules"],
] as const;

const PER_CITY = new Set(["daily", "categories"]);

/** Main links. Daily and Categories open for the city being looked at, if any (else the default city). */
export function SiteNav({ cities }: { cities: string[] }) {
  const pathname = usePathname();
  const [first = "", second = ""] = pathname.split("/").slice(1);
  // A board (/mumbai/gyms) or a city's Daily or Categories page (/daily/mumbai).
  const city = cities.includes(first) ? first : PER_CITY.has(first) && cities.includes(second) ? second : null;

  return (
    <nav className="site-nav" aria-label="Main">
      {PAGES.map(([label, path]) => {
        const here = pathname === path || pathname.startsWith(`${path}/`);
        return (
          <Link key={path} href={city && PER_CITY.has(path.slice(1)) ? `${path}/${city}` : path} aria-current={here ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
      <span className="site-nav-icons">
        <Link
          className="icon-btn"
          href={city ? `/search?city=${city}` : "/search"}
          aria-label="Search businesses"
          aria-current={pathname === "/search" ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="m15 15 5 5" />
          </svg>
        </Link>
        <ThemeToggle />
      </span>
      <span className="nav-break" aria-hidden="true" />
      <Link className="btn btn-primary btn-sm" href="/add">
        Add your business
      </Link>
    </nav>
  );
}
