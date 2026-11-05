import Link from "next/link";

export const metadata = {
  title: "Rules",
  description: "How boards are ranked: the highest total of confirmed bids ranks first, every ranked entry is sponsored, and bids are final.",
};

const RULES = [
  {
    title: "Highest total ranks first",
    body: "A listing's total is the sum of every confirmed bid on that board. The highest total is #1. When two totals are equal, the listing that reached it first ranks higher.",
  },
  {
    title: "The price to pass",
    body: "To move above a listing, pay its total minus yours, plus ₹100. The smallest bid is ₹100. You see the exact amount before you pay.",
  },
  {
    title: "All-time and Today",
    body: "All-time totals add up for good. Today's board resets to zero at midnight in the city's time zone, so every business gets a fresh shot each day.",
  },
  {
    title: "Anyone can bid",
    body: "Owners and fans can both back a listing. A bid counts once its payment is confirmed.",
  },
  {
    title: "Bids are final",
    body: "Bids are non-refundable. A refund or chargeback removes the bid from the total.",
  },
  {
    title: "Every entry is sponsored",
    body: "Ranked entries carry a Sponsored label. Rank is not a review of quality.",
  },
  {
    title: "Listings are reviewed",
    body: "We check links before a listing goes live and remove fake, closed or banned businesses when they are reported.",
  },
  {
    title: "Verified owners",
    body: "An owner who proves control of the listing's website, Instagram or Facebook page gets a Verified badge. Verifying doesn't change rank.",
  },
];

export default function RulesPage() {
  return (
    <div className="inner rules-page">
      <h1 className="h1">Rules</h1>
      <p className="lead">Rank on every board is set by money, and we say so. These rules apply to every city and category.</p>
      <ol className="rules-list" role="list">
        {RULES.map((rule, i) => (
          <li key={rule.title} className="card rules-item">
            <span className="rules-num" aria-hidden="true">{i + 1}</span>
            <h2 className="h3">{rule.title}</h2>
            <p>{rule.body}</p>
          </li>
        ))}
      </ol>
      <p>
        <Link className="btn btn-primary" href="/">See the boards</Link>
      </p>
    </div>
  );
}
