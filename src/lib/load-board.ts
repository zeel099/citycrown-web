import type { BoardType } from "@prisma/client";
import { findBoard, loadRankedBoard } from "./boards";
import { avatarUrls } from "./avatars";
import { avatarFor, PERIOD_LABEL, periodHref, periodTabs, resetNote, toRows, type BoardProps, type MiniBoard } from "./board-view";
import { db } from "./db";

const SIDEBAR_ROWS = 5;

export async function loadBoardProps(citySlug: string, categorySlug: string, type: BoardType): Promise<BoardProps | null> {
  const board = await findBoard(citySlug, categorySlug, type);
  if (!board) return null;
  const basePath = `/${board.city.slug}/${board.category.slug}`;
  const [{ period, ranked }, periods, other, categories] = await Promise.all([
    loadRankedBoard(board),
    periodTabs(board.cityId, board.categoryId, basePath),
    loadMiniBoard(citySlug, categorySlug, type === "ALL_TIME" ? "DAILY" : "ALL_TIME", basePath),
    db.category.findMany({
      where: { active: true, banned: false, boards: { some: { cityId: board.cityId, type: board.type, active: true } } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);
  const ids = ranked.map((l) => l.id);
  const [clicks, pictures] = await Promise.all([clickCounts(ids), avatarUrls(ids)]);
  return {
    boardId: board.id,
    title: { city: board.city.name, category: board.category.name },
    slugs: { city: board.city.slug, category: board.category.slug },
    categories,
    cityCenter: board.city.latitude != null && board.city.longitude != null ? { lat: board.city.latitude, lng: board.city.longitude } : null,
    basePath,
    currency: board.city.currency,
    step: board.step,
    minBid: board.minBid,
    topN: board.topN,
    period: {
      type: board.type,
      endsAt: period.endsAt?.toISOString() ?? null,
      resets: resetNote(board.type, board.city.timeZone),
      href: periodHref(basePath, board.type),
    },
    periods,
    rows: toRows(ranked, board.step, clicks, pictures),
    other,
  };
}

/** The sidebar board: top of the same city and category for the other period. */
async function loadMiniBoard(citySlug: string, categorySlug: string, type: BoardType, basePath: string): Promise<MiniBoard | null> {
  const board = await findBoard(citySlug, categorySlug, type);
  if (!board) return null;
  const { ranked } = await loadRankedBoard(board);
  const top = ranked.filter((l) => l.rank !== null).slice(0, SIDEBAR_ROWS);
  const pictures = await avatarUrls(top.map((l) => l.id));
  return {
    label: type === "DAILY" ? "Today's ranking" : `${PERIOD_LABEL[type]} ranking`,
    href: periodHref(basePath, type),
    rows: top.map((l) => ({ id: l.id, name: l.name, rank: l.rank!, total: l.total, avatar: avatarFor(l.name, pictures.get(l.id)) })),
  };
}

/** Outbound clicks per listing (website, Instagram, Facebook), all time. */
export async function clickCounts(listingIds: string[]): Promise<Map<string, number>> {
  if (!listingIds.length) return new Map();
  const counts = await db.event.groupBy({
    by: ["listingId"],
    where: { listingId: { in: listingIds }, type: { in: ["CLICK_WEBSITE", "CLICK_INSTAGRAM", "CLICK_FACEBOOK"] } },
    _count: { _all: true },
  });
  return new Map(counts.map((c) => [c.listingId, c._count._all]));
}

const CRAWLER = /bot|crawler|spider|preview|whatsapp|facebookexternalhit/i;

/** FR-ANL-01: one VIEW per listing shown in the top N, skipping crawlers. */
export async function recordBoardViews(board: BoardProps, userAgent: string) {
  if (CRAWLER.test(userAgent)) return;
  const shown = board.rows.slice(0, board.topN).map((r) => ({ listingId: r.id, type: "VIEW" as const }));
  if (shown.length) await db.event.createMany({ data: shown });
}
