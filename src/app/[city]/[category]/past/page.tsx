import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { closedPeriodResults, findBoard } from "@/lib/boards";
import { periodHref, zoneLabel } from "@/lib/board-view";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string; category: string }> };

async function load({ params }: Props) {
  const { city, category } = await params;
  return findBoard(city, category, "DAILY");
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const board = await load(props);
  if (!board) return {};
  return {
    title: `Past winners: ${board.category.name} in ${board.city.name}`,
    description: `Each day's #1, #2 and #3 on the ${board.city.name} ${board.category.name} daily board.`,
  };
}

/** FR-PER-03: closed daily periods keep their bids; this is the archive of each day's top three. */
export default async function PastWinnersPage(props: Props) {
  const board = await load(props);
  if (!board) notFound();
  const days = await closedPeriodResults(board);
  const { timeZone, currency } = board.city;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
  const place = (p?: { name: string; total: number }) => (p ? `${p.name} · ${formatMoney(p.total, currency)}` : "–");
  const boardPath = `/${board.city.slug}/${board.category.slug}`;

  return (
    <div className="inner past">
      <p className="crumbs">
        <Link href={periodHref(boardPath, "DAILY")}>
          {board.city.name} · {board.category.name}
        </Link>{" "}
        / Past winners
      </p>
      <h1 className="h1 past-title">Yesterday&apos;s #1 and every day before</h1>
      <p className="lead past-lead">
        Daily boards reset at midnight {zoneLabel(timeZone)}. The final ranking of every day is kept here.
      </p>
      {days.length ? (
        <div className="table-wrap table-stack stack-grid">
          <table className="table past-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">#1</th>
                <th scope="col" className="num">
                  Winning total
                </th>
                <th scope="col">#2</th>
                <th scope="col">#3</th>
                <th scope="col" className="num">
                  Bids
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.id}>
                  <td>{day.format(d.startsAt)}</td>
                  <th scope="row" className="past-winner" data-label="#1">
                    {d.top[0]?.name ?? "–"}
                  </th>
                  <td className="num past-total" data-label="Winning total">{d.top[0] ? formatMoney(d.top[0].total, currency) : "–"}</td>
                  <td data-label="#2">{place(d.top[1])}</td>
                  <td data-label="#3">{place(d.top[2])}</td>
                  <td className="num" data-label="Bids">{d.bids}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="board-empty">
          No finished days yet. Today&apos;s winner shows here after midnight. <Link href={periodHref(boardPath, "DAILY")}>See today&apos;s board</Link>.
        </p>
      )}
    </div>
  );
}
