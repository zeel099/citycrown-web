import type { BoardType } from "@prisma/client";
import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { db } from "@/lib/db";
import { DEFAULT_BOARD } from "@/lib/site";
import { addCategory, addCity, saveBoard, setCategoryActive, setCategoryBanned, setCityActive } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cities, categories and boards" };

const TYPE_LABEL: Record<BoardType, string> = { ALL_TIME: "All-time", DAILY: "Today", WEEKLY: "This week" };

type Props = { searchParams: Promise<{ city?: string | string[] }> };

export default async function AdminSettingsPage({ searchParams }: Props) {
  const { city: cityParam } = await searchParams;
  const [cities, categories] = await Promise.all([
    db.city.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { boards: true } } } }),
    db.category.findMany({ orderBy: [{ banned: "asc" }, { name: "asc" }] }),
  ]);
  const city =
    cities.find((c) => c.slug === cityParam) ?? cities.find((c) => c.slug === DEFAULT_BOARD.city) ?? cities[0];
  const [boards, live] = city
    ? await Promise.all([
        db.board.findMany({
          where: { cityId: city.id },
          include: { category: true },
          orderBy: [{ category: { name: "asc" } }, { type: "asc" }],
        }),
        db.listing.groupBy({ by: ["boardId"], where: { status: "LIVE", board: { cityId: city.id } }, _count: { _all: true } }),
      ])
    : [[], []];
  const liveCount = new Map(live.map((l) => [l.boardId, l._count._all]));

  return (
    <div className="inner admin-page">
      <AdminHeader current="settings" />

      <section className="admin-section" aria-labelledby="cities">
        <h2 id="cities">Cities</h2>
        <div className="table-wrap table-stack stack-grid">
          <table className="table">
            <thead>
              <tr><th>City</th><th>Currency</th><th>Time zone</th><th>Centre</th><th className="num">Boards</th><th>Status</th></tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.id}>
                  <td>{c.name} <span className="admin-sub">{c.country}</span></td>
                  <td data-label="Currency">{c.currency}</td>
                  <td data-label="Time zone">{c.timeZone}</td>
                  <td data-label="Centre">
                    {c.latitude != null && c.longitude != null ? (
                      <a className="admin-link" href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer">
                        {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                      </a>
                    ) : (
                      <span className="admin-sub">Not set</span>
                    )}
                  </td>
                  <td data-label="Boards" className="num">{c._count.boards}</td>
                  <td data-label="Status">
                    <ToggleForm action={setCityActive} id={c.id} on={c.active} onLabel="Live" offLabel="Hidden" turnOn="Show" turnOff="Hide" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ActionForm action={addCity} submitLabel="Add city" className="admin-add" resetOnSuccess>
          <input className="input-sm" name="name" placeholder="City name" aria-label="City name" maxLength={60} required />
          <input className="input-sm input-code" name="country" defaultValue="IN" aria-label="Country code" maxLength={2} required />
          <input className="input-sm input-code" name="currency" defaultValue="INR" aria-label="Currency code" maxLength={3} required />
          <input className="input-sm" name="timeZone" defaultValue="Asia/Kolkata" aria-label="Time zone" maxLength={60} required />
          <input
            className="input-sm"
            name="centre"
            placeholder="Centre: 28.6315, 77.2167"
            aria-label="City centre, latitude and longitude"
            aria-describedby="city-centre-help"
            maxLength={60}
            required
          />
        </ActionForm>
        <p className="admin-note" id="city-centre-help">
          Centre: right-click the middle of the city in Google Maps and click the numbers to copy them. Business locations
          on the city&apos;s boards must be within 60 km of it.
        </p>
      </section>

      <section className="admin-section" aria-labelledby="categories">
        <h2 id="categories">Categories</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Category</th><th>Shown</th><th>Banned</th></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <ToggleForm action={setCategoryActive} id={c.id} on={c.active} onLabel="Yes" offLabel="No" turnOn="Show" turnOff="Hide" />
                  </td>
                  <td>
                    <ToggleForm action={setCategoryBanned} id={c.id} on={c.banned} onLabel="Banned" offLabel="Allowed" turnOn="Ban" turnOff="Allow" onTone="tag-banned" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ActionForm action={addCategory} submitLabel="Add category" className="admin-add" resetOnSuccess>
          <input className="input-sm" name="name" placeholder="Category name" aria-label="Category name" maxLength={60} required />
          <label className="check admin-add-check">
            <input type="checkbox" name="banned" />
            Banned category
          </label>
        </ActionForm>
      </section>

      {city && (
        <section className="admin-section" aria-labelledby="boards">
          <div className="admin-section-head">
            <h2 id="boards">Boards in {city.name}</h2>
            <nav className="seg admin-switch" aria-label="Choose a city">
              {cities.map((c) => (
                <Link key={c.id} href={`/admin/settings?city=${c.slug}`} aria-current={c.id === city.id ? "page" : undefined}>
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
          <p className="admin-note">Amounts in {city.currency}. Changes apply immediately. Top spots can be 5, 6 or 7.</p>
          <div className="table-wrap table-stack stack-grid">
            <table className="table">
              <thead>
                <tr>
                  <th>Board</th><th className="num">Live listings</th><th>Top spots</th><th>Step</th><th>Minimum bid</th><th>Visible</th>
                  <th><span className="visually-hidden">Save</span></th>
                </tr>
              </thead>
              <tbody>
                {boards.map((b) => {
                  const form = `board-${b.id}`;
                  const label = `${b.category.name} · ${TYPE_LABEL[b.type]}`;
                  return (
                    <tr key={b.id}>
                      <td>{label}</td>
                      <td data-label="Live listings" className="num">{liveCount.get(b.id) ?? 0}</td>
                      <td data-label="Top spots">
                        <input className="input-sm input-num" form={form} name="topN" type="number" min={5} max={7} step={1} defaultValue={b.topN} aria-label={`Top spots, ${label}`} required />
                      </td>
                      <td data-label="Step">
                        <input className="input-sm input-num" form={form} name="step" type="number" min={0.01} step={0.01} defaultValue={b.step / 100} aria-label={`Step, ${label}`} required />
                      </td>
                      <td data-label="Minimum bid">
                        <input className="input-sm input-num" form={form} name="minBid" type="number" min={0.01} step={0.01} defaultValue={b.minBid / 100} aria-label={`Minimum bid, ${label}`} required />
                      </td>
                      <td data-label="Visible">
                        <input className="admin-checkbox" form={form} name="visible" type="checkbox" defaultChecked={b.active} aria-label={`Visible, ${label}`} />
                      </td>
                      <td>
                        <ActionForm action={saveBoard} submitLabel="Save" id={form} className="admin-save">
                          <input type="hidden" name="id" value={b.id} />
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

type ToggleProps = {
  action: (formData: FormData) => Promise<void>;
  id: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  turnOn: string;
  turnOff: string;
  onTone?: string;
};

/** Current state as a tag, and a button that flips it. */
function ToggleForm({ action, id, on, onLabel, offLabel, turnOn, turnOff, onTone = "tag-live" }: ToggleProps) {
  return (
    <form action={action} className="admin-inline">
      <span className={on ? `tag ${onTone}` : "tag"}>{on ? onLabel : offLabel}</span>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="on" value={String(!on)} />
      <button className="btn btn-secondary btn-sm">{on ? turnOff : turnOn}</button>
    </form>
  );
}
