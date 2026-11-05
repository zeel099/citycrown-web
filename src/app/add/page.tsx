import { AddBusinessForm, type CityOption } from "@/components/AddBusinessForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add your business" };

type Props = { searchParams: Promise<{ city?: string | string[]; category?: string | string[] }> };

const one = (value?: string | string[]) => (typeof value === "string" ? value : undefined);

/** Every city with its open categories; the board page links here with ?city=&category= preselected. */
async function openCities(): Promise<CityOption[]> {
  const boards = await db.board.findMany({
    where: { active: true, city: { active: true }, category: { active: true, banned: false } },
    select: { city: { select: { slug: true, name: true, latitude: true, longitude: true } }, category: { select: { slug: true, name: true } } },
    orderBy: [{ city: { name: "asc" } }, { category: { name: "asc" } }],
  });
  const cities = new Map<string, CityOption>();
  for (const { city, category } of boards) {
    const center = city.latitude != null && city.longitude != null ? { lat: city.latitude, lng: city.longitude } : null;
    const entry = cities.get(city.slug) ?? { slug: city.slug, name: city.name, center, categories: [] };
    if (!entry.categories.some((c) => c.slug === category.slug)) entry.categories.push(category);
    cities.set(city.slug, entry);
  }
  return [...cities.values()];
}

export default async function AddPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="inner add-page">
      <div className="add-intro">
        <p className="eyebrow-lg">Add your business</p>
        <h1 className="h2">Get on the board free</h1>
        <p className="lead">
          Listing is free. Your business appears as unranked until someone bids on it. We review every new listing before
          it goes live, usually within a day.
        </p>
      </div>
      <AddBusinessForm cities={await openCities()} initialCity={one(params.city)} initialCategory={one(params.category)} />
    </div>
  );
}
