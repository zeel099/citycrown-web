import Link from "next/link";
import type { MiniBoard as MiniBoardData } from "@/lib/board-view";
import { formatMoney } from "@/lib/money";
import { Avatar } from "./Avatar";

/** Sidebar ranking for the board's other period ("Today's ranking", "See all ›"). */
export function MiniBoard({ board, currency }: { board: MiniBoardData; currency: string }) {
  return (
    <section className="mini-board" aria-labelledby="mini-board-title">
      <div className="mini-board-head">
        <h2 id="mini-board-title" className="mini-board-title">
          {board.label}
        </h2>
        <Link className="mini-board-all" href={board.href} aria-label={`See all of ${board.label}`}>
          See all ›
        </Link>
      </div>
      {board.rows.length ? (
        <ol className="mini-board-rows">
          {board.rows.map((r) => (
            <li key={r.id}>
              <Link className="mini-row" href={board.href}>
                <span className="mini-rank">#{r.rank}</span>
                <Avatar avatar={r.avatar} size="sm" />
                <span className="mini-name">{r.name}</span>
                <span className="mini-total">{formatMoney(r.total, currency)}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mini-board-empty">No bids yet. The first one takes #1.</p>
      )}
    </section>
  );
}
