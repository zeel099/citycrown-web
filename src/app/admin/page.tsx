import type { ListingStatus } from "@prisma/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { LocationEditor } from "@/components/admin/LocationEditor";
import { db } from "@/lib/db";
import { listingUrl } from "@/lib/listings";
import { formatMoney } from "@/lib/money";
import { approveListing, freezeListing, recheckLink, rejectListing, rejectOwner, resolveReport, setListingLocation, verifyOwner } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const VERIFY_LINK = { WEBSITE: "websiteUrl", INSTAGRAM: "instagramUrl", FACEBOOK: "facebookUrl" } as const;

export default async function AdminPage() {
  const [pending, unlocated, verifications, reports, revenue] = await Promise.all([
    db.listing.findMany({
      where: { status: "PENDING" },
      include: { board: { include: { city: true, category: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Live businesses customers can't find on a map yet.
    db.listing.findMany({
      where: { status: "LIVE", latitude: null },
      include: { board: { include: { city: true, category: true } } },
      orderBy: [{ isSeed: "asc" }, { createdAt: "desc" }],
    }),
    db.verification.findMany({
      where: { status: "IN_REVIEW" },
      include: { user: true, listing: { include: { board: { include: { city: true, category: true } } } } },
      orderBy: { updatedAt: "asc" },
    }),
    db.report.findMany({ where: { status: "OPEN" }, include: { listing: true }, orderBy: { createdAt: "asc" } }),
    db.$queryRaw<{ city: string; currency: string; bids: bigint; total: bigint }[]>`
      SELECT c.name AS city, b.currency, COUNT(*) AS bids, SUM(b.amount) AS total
      FROM "Bid" b
      JOIN "Listing" l ON l.id = b."listingId"
      JOIN "Board" bo ON bo.id = l."boardId"
      JOIN "City" c ON c.id = bo."cityId"
      WHERE b.status = 'CONFIRMED'
      GROUP BY c.name, b.currency
      ORDER BY total DESC`,
  ]);
  const newListings = onePerBusiness(pending);
  const missingLocation = onePerBusiness(unlocated);

  return (
    <div className="inner admin-page">
      <AdminHeader current="moderation" />

      <section className="admin-section" aria-labelledby="new-listings">
        <h2 id="new-listings">New listings ({newListings.length})</h2>
        {newListings.length === 0 ? (
          <p className="admin-empty">Nothing waiting for review.</p>
        ) : (
          <div className="table-wrap table-stack">
            <table className="table">
              <thead>
                <tr><th>Business</th><th>Board</th><th>Links</th><th>Location</th><th>Link check</th><th>Submitted</th><th>Decision</th></tr>
              </thead>
              <tbody>
                {newListings.map((l) => (
                  <tr key={l.id}>
                    <td data-label="Business"><b>{l.name}</b><br /><span className="admin-sub">{l.submitterEmail ?? "No email"}</span></td>
                    <td data-label="Board">{l.board.city.name} → {l.board.category.name}</td>
                    <td data-label="Links">
                      {[l.websiteUrl, l.instagramUrl, l.facebookUrl].filter((u): u is string => !!u).map((u) => (
                        <div key={u}><a className="admin-link" href={u} target="_blank" rel="noopener noreferrer">{u}</a></div>
                      ))}
                    </td>
                    <td data-label="Location">
                      <LocationEditor listingId={l.id} name={l.name} location={placeOf(l)} city={cityOf(l.board.city)} action={setListingLocation} />
                    </td>
                    <td data-label="Link check">
                      <div className="admin-check">
                        <p><CheckTag ok={l.linkCheckOk} /> {l.linkCheckNote && <span className="admin-sub">{l.linkCheckNote}</span>}</p>
                        <form action={recheckLink}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className="link-btn">Recheck</button>
                        </form>
                      </div>
                    </td>
                    <td data-label="Submitted">{l.createdAt.toLocaleString("en-IN", { timeZone: l.board.city.timeZone })}</td>
                    <td data-label="Decision">
                      <div className="admin-stack">
                        <form action={approveListing}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className="btn btn-primary btn-sm">Approve</button>
                        </form>
                        <ReasonForm action={rejectListing} id={l.id} label={`Reason for rejecting ${l.name}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section" aria-labelledby="verifications">
        <h2 id="verifications">Verification requests ({verifications.length})</h2>
        {verifications.length === 0 ? (
          <p className="admin-empty">No verifications waiting for a manual check.</p>
        ) : (
          <div className="table-wrap table-stack">
            <table className="table">
              <thead>
                <tr><th>Business</th><th>Requested by</th><th>Check this link for the code</th><th>Decision</th></tr>
              </thead>
              <tbody>
                {verifications.map((v) => {
                  const url = v.listing[VERIFY_LINK[v.method]] ?? listingUrl(v.listing);
                  return (
                    <tr key={v.id}>
                      <td data-label="Business">{v.listing.name}</td>
                      <td data-label="Requested by">{v.user?.email ?? "No email left"}</td>
                      <td data-label="Check this link for the code">
                        {url ? <a className="admin-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a> : "No link on the listing"}
                        <br /><code className="admin-code">{v.code}</code>
                        <br /><span className="admin-sub">{v.listing.board.city.name} → {v.listing.board.category.name}</span>
                      </td>
                      <td data-label="Decision">
                        <div className="admin-inline">
                          <form action={verifyOwner}>
                            <input type="hidden" name="id" value={v.id} />
                            <button className="btn btn-primary btn-sm">Code is there: verify</button>
                          </form>
                          <ReasonForm action={rejectOwner} id={v.id} label={`Reason for rejecting ${v.listing.name}`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section" aria-labelledby="reports">
        <h2 id="reports">Open reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="admin-empty">No open reports.</p>
        ) : (
          <div className="table-wrap table-stack">
            <table className="table">
              <thead>
                <tr><th>Listing</th><th>Reason</th><th>Reporter</th><th>Action</th></tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Listing">{r.listing.name} <StatusTag status={r.listing.status} /></td>
                    <td data-label="Reason">{r.reason}</td>
                    <td data-label="Reporter">{r.reporterContact ?? "Anonymous"}</td>
                    <td data-label="Action">
                      <div className="admin-inline">
                        <form action={freezeListing}>
                          <input type="hidden" name="id" value={r.listingId} />
                          <button className="btn btn-secondary btn-sm" disabled={r.listing.status === "FROZEN"}>Freeze listing</button>
                        </form>
                        <form action={resolveReport}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="btn btn-secondary btn-sm">Resolve</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section" aria-labelledby="locations">
        <h2 id="locations">Businesses without a location ({missingLocation.length})</h2>
        <p className="admin-note">Customers can't see how far these are or get directions. Owners add a location when they list or verify; you can add one here.</p>
        {missingLocation.length === 0 ? (
          <p className="admin-empty">Every live business has a location.</p>
        ) : (
          <div className="table-wrap table-stack">
            <table className="table">
              <thead>
                <tr><th>Business</th><th>Board</th><th>Link</th><th>Location</th></tr>
              </thead>
              <tbody>
                {missingLocation.slice(0, MISSING_SHOWN).map((l) => {
                  const url = listingUrl(l);
                  return (
                    <tr key={l.id}>
                      <td data-label="Business">{l.name}{l.isSeed && <span className="admin-sub"> · seed</span>}</td>
                      <td data-label="Board">{l.board.city.name} → {l.board.category.name}</td>
                      <td data-label="Link">{url ? <a className="admin-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a> : "–"}</td>
                      <td data-label="Location">
                        <LocationEditor listingId={l.id} name={l.name} location={null} city={cityOf(l.board.city)} action={setListingLocation} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {missingLocation.length > MISSING_SHOWN && <p className="admin-note">Showing the first {MISSING_SHOWN}, newest first.</p>}
      </section>

      <section className="admin-section" aria-labelledby="revenue">
        <h2 id="revenue">Confirmed revenue by city</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>City</th><th className="num">Bids</th><th className="num">Total (gross)</th></tr>
            </thead>
            <tbody>
              {revenue.length === 0 && (
                <tr><td colSpan={3} className="admin-sub">No confirmed bids yet.</td></tr>
              )}
              {revenue.map((r) => (
                <tr key={r.city + r.currency}>
                  <td>{r.city}</td>
                  <td className="num">{Number(r.bids)}</td>
                  <td className="num">{formatMoney(Number(r.total), r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** A submission creates one listing per board; moderators see the business once. */
const MISSING_SHOWN = 25;

const placeOf = (l: { latitude: number | null; longitude: number | null; address: string | null }) =>
  l.latitude != null && l.longitude != null ? { lat: l.latitude, lng: l.longitude, address: l.address ?? "" } : null;

const cityOf = (c: { slug: string; name: string; latitude: number | null; longitude: number | null }) => ({
  slug: c.slug,
  name: c.name,
  center: c.latitude != null && c.longitude != null ? { lat: c.latitude, lng: c.longitude } : null,
});

function onePerBusiness<T extends { normalizedName: string; board: { cityId: string; categoryId: string; type: string } }>(listings: T[]) {
  const byBusiness = new Map<string, T>();
  for (const l of listings) {
    const key = `${l.board.cityId}|${l.board.categoryId}|${l.normalizedName}`;
    const seen = byBusiness.get(key);
    if (!seen || (seen.board.type !== "ALL_TIME" && l.board.type === "ALL_TIME")) byBusiness.set(key, l);
  }
  return [...byBusiness.values()];
}

function CheckTag({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="tag">Not checked</span>;
  return ok ? <span className="tag tag-live">Passed</span> : <span className="tag tag-danger">Failed</span>;
}

function StatusTag({ status }: { status: ListingStatus }) {
  const tone = status === "LIVE" ? " tag-live" : status === "PENDING" ? "" : " tag-danger";
  return <span className={`tag${tone}`}>{status}</span>;
}

function ReasonForm({ action, id, label }: { action: (formData: FormData) => Promise<void>; id: string; label: string }) {
  return (
    <form action={action} className="admin-inline">
      <input type="hidden" name="id" value={id} />
      <input className="input-sm" type="text" name="reason" placeholder="Reason" aria-label={label} maxLength={200} />
      <button className="btn btn-secondary btn-sm">Reject</button>
    </form>
  );
}
