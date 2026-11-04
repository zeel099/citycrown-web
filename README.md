# Best in the City

City × category boards where local businesses are ranked by the total amount bid on them. This is the MVP from the
Functional Specification Document (FSD v0.1).

Stack: Next.js 15 (App Router, TypeScript), PostgreSQL with Prisma 6, Razorpay for INR, Stripe for other currencies,
Vitest for tests.

## Run it locally

Requires Node 20+ and PostgreSQL 14+.

```bash
npm install
```

```bash
cp .env.example .env
```

Edit `DATABASE_URL` in `.env` if your database differs, then:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000. The seed creates Surat, Ahmedabad and Mumbai with 10 categories each, all-time and daily
boards and free seed listings, plus Pune, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Gurugram, Noida, Mohali,
Chandigarh, Kochi, Indore and Jaipur with empty boards (every city has its centre, used by the location check; staff
add more in /admin/settings). Outside production it also adds sample bids (every bid is at
least ₹100), sample Google ratings, two verified Surat cafes, three verifications in progress, three paid bids with GST
receipts, a listing waiting for review and an open report.

There are no accounts: anyone can bid. Owners paste their Instagram handle, Facebook page or website into the claim bar
at the top of a board. The link is checked online as they type (`src/lib/online-check.ts`): a real Instagram
account, Facebook page or website is confirmed and its name filled in, and one that doesn't exist can't claim a rank.
If Instagram, Facebook or the site can't be reached, the owner can continue and staff see the link as unchecked in
/admin. A business that isn't on the board yet is added with its first bid and goes live once the payment is confirmed. Owners verify at `/verify/<listing>` by publishing a code on their own link. Receipts open from
the private link in the receipt email, which also attaches the GST tax invoice as a PDF (also downloadable from the
receipt page). Email goes out through SMTP (`SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`, e.g. Gmail with an app password)
or Resend (`RESEND_API_KEY`). Without either, emails aren't sent. In development every message, attachments included,
is kept at `/dev/outbox` with whether it was delivered (and why not), and a message kept there can be sent once email
is set up. The templates can be previewed with sample data at `/dev/emails`.

Every business has a location. Owners give it when they list (claim bar or Add your business): search an address,
use their current location or paste a Google Maps link, then drag the pin; it must be within 60 km of the board's
city. Instagram-only businesses do the same. Owners of businesses already listed add it while verifying, and staff
can set any location in /admin. Customers tap "Distance from me" to see how far each business is (worked out in
their browser; their location isn't sent to the server) and open a card for its map and Google Maps directions.

Once a business's first bid is paid, its Instagram or Facebook profile picture (or its website's icon) is saved and
shown on the board instead of the letter tile. `npm run avatars:refresh` fills in pictures for live businesses that
don't have one yet.

With `PAYMENT_PROVIDER="mock"` (the default in `.env.example`) bids are confirmed locally without a gateway, so the whole
bid flow works with no keys. Admin is at `/admin` (basic auth from `ADMIN_USER` / `ADMIN_PASSWORD`).

Optional services, all set in `.env` (see `.env.example`): SMTP or Resend for email, Google Places for
ratings (`npm run ratings:refresh`), and `SELLER_NAME` / `SELLER_GSTIN` / `SELLER_ADDRESS` for tax invoices.

Other scripts:

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

## Real payments

Set `PAYMENT_PROVIDER="auto"`: INR boards use Razorpay, any other currency uses Stripe (FR-PAY-01).

| Gateway | Keys | Webhook URL | Events to enable |
| --- | --- | --- | --- |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `/api/webhooks/razorpay` | `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, `payment.dispute.created` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` | `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created` |

A bid only counts after a signature-verified webhook confirms it (FR-PAY-03). Confirmation is idempotent: a replayed
webhook returns `already-confirmed` and never double-counts (NFR-03). Refunds and chargebacks reverse the bid and write
an audit log entry (FR-PAY-05).

## How it's organised

```
prisma/schema.prisma        data model (FSD section 7)
prisma/seed.ts              launch cities, categories, boards, seed listings
src/lib/ranking.ts          rank order, tie-break, price to pass (FSD section 5), pure + tested
src/lib/time.ts             daily/weekly period bounds in the city's time zone, pure + tested
src/lib/boards.ts           current period (opened lazily at reset), ranked board from the bid ledger
src/lib/bids.ts             create bid, confirm / fail / reverse payment (invoice number, receipt and outbid emails)
src/lib/payments/           Razorpay, Stripe and mock providers behind one interface
src/lib/listings.ts         submit listing to every board of a city and category, duplicate check, banned categories
src/lib/link-check.ts       safe server-side fetch for the moderation link check
src/lib/online-check.ts     claim bar: does a pasted Instagram account, Facebook page or website exist? (with its name)
src/lib/business-link.ts    reads handles and links pasted into the claim bar (also used in the browser)
src/lib/verification.ts     owner verification codes (no account needed), safe page fetch, markVerified
src/lib/invoices.ts         sequential GST invoice numbers per financial year, amount in words
src/lib/invoice-data.ts     one invoice for the receipt page, the PDF and the email
src/lib/invoice-pdf.ts      the A4 tax invoice PDF (standard fonts, no dependencies)
src/lib/avatars.ts          business pictures and Instagram follower counts saved for the board
src/lib/geo.ts, geocode.ts  distances, Google Maps links, address search (OpenStreetMap via Photon)
src/lib/locations.ts        business locations: checked against the city, saved on every board
src/components/map/         location picker and maps (Leaflet)
src/lib/daily.ts            Daily page: each day in a city ranked across its categories' Today boards
src/lib/categories.ts       Categories page: top three of every category, most active categories today
src/lib/site-stats.ts       About page numbers (visitors, total bid, highest total, businesses listed)
src/lib/visits.ts           "20 online · 2,849 visitors today": daily visitor hashes, no IP stored
src/lib/search.ts           header search: businesses by name or handle, cities, categories
src/lib/email/, mailer.ts   transactional email templates and sending (SMTP or Resend)
src/app/globals.css         design tokens and shared components from the Figma style sheet
src/styles/                 board, page (Daily, Categories, About, Search), account and admin styles; dark theme in globals.css
src/app/page.tsx            home with the Surat → Cafes board
src/app/[city]/[category]/  board pages, e.g. /surat/cafes, ?period=today, /surat/cafes/past
src/app/add/                add-your-business form
src/app/daily/              /daily, /daily/mumbai: today live, then each closed day
src/app/categories/         /categories, /categories/mumbai: every category's leaders
src/app/about/              the story and live numbers (header "stats→")
src/app/search/             search from the header's magnifier
src/app/rules/              ranking rules
src/app/verify/[listingId]  owner verification by website, Instagram or Facebook
src/app/receipts/[key]      GST tax invoice, opened from the private link in the receipt email
src/app/admin/              moderation queue, reports, revenue; settings for cities, categories and boards
src/app/api/                bids, bid status, listings, reports, webhooks, presence (live visitor count), dev mock payments
src/app/dev/emails          email previews (development only)
src/app/go/[listingId]      outbound link redirect that counts clicks
design/landing.html         original static design (superseded by the Figma file)
```

Rank is never stored. Each board read sums confirmed bids in the current period, so a refund or a period reset needs no
recalculation job.

## FSD coverage

| Module | Done | Not yet |
| --- | --- | --- |
| Boards (BRD) | 01–07, 08 share board, 09 Google rating (needs `GOOGLE_PLACES_API_KEY` and place ids) | |
| Listings (LST) | 01–06 (05 as owner verification) | |
| Bidding (BID) | 01–06 | |
| Payments (PAY) | 01–05 (04: GST invoices with sequential numbers, emailed receipts) | VAT for non-INR cities |
| Periods (PER) | 01–03 (daily; weekly supported in the model) | |
| Analytics (ANL) | 01 views and clicks recorded, click counts on board cards | 02 owner dashboard (removed with sign-in) |
| Admin (ADM) | 01–06 | CSV export |
| Accounts (ACC) | 02 outbid alerts (to the email an owner leaves when verifying) | 01, 03 removed by decision: no sign-in, so no bid history page; unsubscribe link for outbid alerts |

## Before launch

- Legal review of the brand name and the "Sponsored" wording (CCPA 2022 misleading-ads guidelines).
- Replace admin basic auth with staff accounts and 2FA (NFR-05).
- Tax-compliant invoices: GST registration, then fill in `SELLER_NAME`, `SELLER_GSTIN` and `SELLER_ADDRESS`.
- Bid amounts are stored as 32-bit integers in paise, which caps a single bid at about ₹2.1 crore. Move to `BigInt`
  if that could ever be too low.
- Rate limiting on `/api/bids`, `/api/listings`, `/api/listings/lookup`, `/api/reports` and the verify page's Check now (now that there are no accounts, these are open to anyone).
