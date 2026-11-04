import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoardView } from "@/components/BoardView";
import { Pickers } from "@/components/Pickers";
import { PERIOD_PARAM } from "@/lib/boards";
import { loadBoardProps, recordBoardViews } from "@/lib/load-board";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<{ period?: string }>;
};

async function load({ params, searchParams }: Props) {
  const { city, category } = await params;
  const { period } = await searchParams;
  const type = PERIOD_PARAM[period ?? "all-time"] ?? "ALL_TIME";
  return { city, category, type, board: await loadBoardProps(city, category, type) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { board, type } = await load(props);
  if (!board) return {};
  const when = type === "DAILY" ? "Today's top bids" : type === "WEEKLY" ? "This week's top bids" : "Top bids";
  return {
    title: `${when}: ${board.title.category} in ${board.title.city}`,
    description: `${board.title.category} in ${board.title.city}, ranked by the total amount bid. Every entry is sponsored.`,
  };
}

export default async function BoardPage(props: Props) {
  const { type, board } = await load(props);
  if (!board) notFound();
  await recordBoardViews(board, (await headers()).get("user-agent") ?? "");

  const query = type === "ALL_TIME" ? "" : board.period.href.slice(board.basePath.length);
  return (
    <div className="inner board-page">
      <Suspense>
        <BoardView key={board.boardId} {...board} pickers={<Pickers citySlug={board.slugs.city} categorySlug={board.slugs.category} query={query} />} />
      </Suspense>
    </div>
  );
}
