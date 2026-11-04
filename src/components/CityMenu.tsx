import Link from "next/link";
import { DetailsMenu } from "./DetailsMenu";

type Props = {
  cities: { slug: string; name: string }[];
  current: string;
  href: (slug: string) => string; // where choosing a city goes
};

/** "Surat ▾": the city dropdown on boards, Daily and Categories. */
export function CityMenu({ cities, current, href }: Props) {
  const name = cities.find((c) => c.slug === current)?.name ?? current;
  return (
    <DetailsMenu className="city-menu" key={current}>
      <summary aria-label={`City: ${name}. Change city`}>
        {name}
        <svg viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul className="city-menu-list">
        {cities.map((c) => (
          <li key={c.slug}>
            {c.slug === current ? <span aria-current="true">{c.name}</span> : <Link href={href(c.slug)}>{c.name}</Link>}
          </li>
        ))}
      </ul>
    </DetailsMenu>
  );
}
