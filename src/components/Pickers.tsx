import Link from "next/link";
import { db } from "@/lib/db";
import { CategoryNav } from "./CategoryNav";
import { CityMenu } from "./CityMenu";

type Props = {
  citySlug: string;
  categorySlug: string;
  query?: string; // kept when switching boards, e.g. "?period=today"
};

/** City menu and category bar; each choice links to a board page. */
export async function Pickers({ citySlug, categorySlug, query = "" }: Props) {
  const [cities, categories] = await Promise.all([
    db.city.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { active: true, banned: false }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="pickers">
      <CityMenu cities={cities} current={citySlug} href={(slug) => `/${slug}/${categorySlug}${query}`} />
      <CategoryNav current={categorySlug}>
        {categories.map((c) => (
          <Link key={c.id} href={`/${citySlug}/${c.slug}${query}`} aria-current={c.slug === categorySlug ? "page" : undefined}>
            {c.name}
          </Link>
        ))}
      </CategoryNav>
    </div>
  );
}
