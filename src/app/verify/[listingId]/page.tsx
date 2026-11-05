import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Verification, VerificationMethod } from "@prisma/client";
import { CopyButton } from "@/components/account/CopyButton";
import { SubmitButton } from "@/components/account/SubmitButton";
import { LocationField } from "@/components/map/LocationField";
import { boardHref, VerifiedBadge } from "@/components/account/ui";
import { db } from "@/lib/db";
import type { LatLng, Place } from "@/lib/geo";
import { availableMethods, getOrCreateVerification, hostOf, META_NAME, METHODS, methodFromSlug, WELL_KNOWN_PATH } from "@/lib/verification";
import { checkNow, sendForReview } from "./actions";

export const metadata: Metadata = { title: "Verify your business" };

type Params = { params: Promise<{ listingId: string }>; searchParams: Promise<{ method?: string | string[] }> };

/** Owner verification (FR-LST-05), Figma 13–16 and 35. Open to anyone: the code on the business's own link is the proof. */
export default async function VerifyPage({ params, searchParams }: Params) {
  const { listingId } = await params;
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { board: { include: { city: true, category: true } } },
  });
  if (!listing || listing.status === "REMOVED" || listing.status === "REJECTED" || listing.status === "AWAITING_PAYMENT") notFound();

  const { board } = listing;
  const head = (
    <>
      <p className="crumbs">
        <Link href={boardHref(board)}>
          {board.city.name} · {board.category.name}
        </Link>{" "}
        / Verify
      </p>
      <h1 className="h1 verify-title">Verify {listing.name}</h1>
    </>
  );

  if (listing.verifiedAt) {
    return (
      <div className="inner verify">
        {head}
        <div className="card card-sm verify-card">
          <p className="verify-done">
            <VerifiedBadge /> {listing.name} is a verified business.
          </p>
          <p>
            <Link className="btn btn-primary" href={boardHref(board)}>
              Back to the board
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const methods = availableMethods(listing);
  const blocked = methods.length === 0 ? "This business has no website, Instagram or Facebook link to verify with." : null;

  return (
    <div className="inner verify">
      {head}
      <p className="lead verify-lead">
        Prove you run this business by adding a code to one of its links. Verified businesses get a badge on every board
        they&apos;re on. No account needed.
      </p>
      {blocked ? (
        <div className="card card-sm verify-card">
          <p className="notice notice-info">{blocked}</p>
        </div>
      ) : (
        <VerifyCard
          listing={listing}
          methods={methods}
          city={{
            slug: board.city.slug,
            name: board.city.name,
            center: board.city.latitude != null && board.city.longitude != null ? { lat: board.city.latitude, lng: board.city.longitude } : null,
          }}
          verification={await getOrCreateVerification(listing.id, methods[0])}
          requested={methodFromSlug([(await searchParams).method].flat()[0])}
        />
      )}
    </div>
  );
}

type ListingLinks = {
  id: string;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

function VerifyCard({
  listing,
  methods,
  city,
  verification: v,
  requested,
}: {
  listing: ListingLinks;
  methods: VerificationMethod[];
  city: { slug: string; name: string; center: LatLng | null };
  verification: Verification;
  requested: VerificationMethod | null;
}) {
  const method = requested && methods.includes(requested) ? requested : methods.includes(v.method) ? v.method : methods[0];
  const { label, slug } = METHODS[method];
  const link = listing[METHODS[method].field]!;
  const current = v.method === method;
  const social = method !== "WEBSITE";
  const inReview = current && v.status === "IN_REVIEW";
  const checked = current && v.lastCheckedAt !== null && (v.status === "PENDING" || v.status === "REJECTED");
  // The location waiting on this verification, else the one the business has.
  const location: Place | null =
    v.pendingLatitude != null && v.pendingLongitude != null
      ? { lat: v.pendingLatitude, lng: v.pendingLongitude, address: v.pendingAddress ?? "" }
      : listing.latitude != null && listing.longitude != null
        ? { lat: listing.latitude, lng: listing.longitude, address: listing.address ?? "" }
        : null;
  const hidden = (
    <>
      <input type="hidden" name="listingId" value={listing.id} />
      <input type="hidden" name="method" value={slug} />
    </>
  );

  return (
    <div className="card card-sm verify-card">
      <nav className="seg" aria-label="Verification method">
        {methods.map((m) => (
          <Link key={m} href={`?method=${METHODS[m].slug}`} aria-current={m === method ? "page" : undefined} replace scroll={false}>
            {METHODS[m].label}
          </Link>
        ))}
      </nav>

      {inReview ? (
        <>
          <p className="notice notice-info">
            In review. Our team is checking {label} for code <b>{v.code}</b>. This usually takes less than a day.
          </p>
          <p className="notice notice-good" role="status">
            Sent for review. {v.userId ? "We'll email you when it's done." : "Check back here, or look for the Verified badge on the board."}
          </p>
        </>
      ) : (
        <>
          <ol className="steps">
            {social ? <SocialSteps link={link} code={v.code} method={method} /> : <WebsiteSteps link={link} code={v.code} />}
          </ol>
          <form action={checkNow} className="verify-form">
            {hidden}
            <div className="field verify-email">
              <label htmlFor="verify-email">Your email (optional)</label>
              <input id="verify-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={200} />
              <p className="field-hint">For review updates, and an alert if your business loses #1.</p>
            </div>
            <div className="verify-location">
              <LocationField
                name="location"
                initial={location}
                city={city}
                label={location ? "Business location" : "Business location: add it so customers can see how far you are"}
              />
            </div>
            <div className="verify-actions">
              <SubmitButton className="btn btn-primary" pendingLabel="Checking…" formAction={checkNow}>
                Check now
              </SubmitButton>
              {social && checked && (
                <SubmitButton className="btn btn-secondary" pendingLabel="Sending…" formAction={sendForReview}>
                  Send for review
                </SubmitButton>
              )}
            </div>
          </form>
          {checked && v.lastCheckNote && (
            <p className={`notice ${v.status === "REJECTED" || !social ? "notice-error" : "notice-info"}`} role="status">
              {v.status === "REJECTED" ? `Not verified: ${v.lastCheckNote}` : v.lastCheckNote}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CodeBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="code-box">
      <code>{value}</code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

function WebsiteSteps({ link, code }: { link: string; code: string }) {
  const host = hostOf(link);
  return (
    <>
      <li>
        <p>
          Add this tag inside the <code>&lt;head&gt;</code> of your homepage at {host}:
        </p>
        <CodeBox value={`<meta name="${META_NAME}" content="${code}">`} label="Copy meta tag" />
      </li>
      <li>
        <p>
          Or upload a text file to {host}
          {WELL_KNOWN_PATH} containing:
        </p>
        <CodeBox value={code} label="Copy code" />
      </li>
      <li>
        <p>Publish the change, then press Check now. You can remove it once you&apos;re verified.</p>
      </li>
    </>
  );
}

function SocialSteps({ link, code, method }: { link: string; code: string; method: VerificationMethod }) {
  const profile = profileLabel(link);
  return (
    <>
      <li>
        <p>
          Open{" "}
          {/^https?:\/\//i.test(link) ? (
            <a className="text-link" href={link} target="_blank" rel="noopener noreferrer">
              {profile}
            </a>
          ) : (
            profile
          )}{" "}
          and edit your {method === "INSTAGRAM" ? "bio" : "page's intro"}.
        </p>
      </li>
      <li>
        <p>Add this code anywhere in it and save:</p>
        <CodeBox value={code} label="Copy code" />
      </li>
      <li>
        <p>Press Check now. If we can&apos;t read your profile, send it for review and our team will check it by hand.</p>
      </li>
    </>
  );
}

/** "https://www.instagram.com/monsoonbeans/" → "instagram.com/monsoonbeans". */
function profileLabel(link: string): string {
  try {
    const url = new URL(link);
    return `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return link;
  }
}
