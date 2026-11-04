import { NextResponse } from "next/server";
import { linkCandidates } from "@/lib/business-link";
import { sessionHash } from "@/lib/events";
import { BLOCKED, findByLink, LINK_HELP } from "@/lib/listings";
import { checkOnline, type OnlineCheck } from "@/lib/online-check";
import { allowOnlineCheck } from "@/lib/rate-limit";

/** What the browser sees: the image is served by /api/listings/avatar, never linked directly. */
function forBrowser(online: OnlineCheck, link: string) {
  if (online.status !== "found") return { online, avatar: null };
  const { image, ...rest } = online;
  return { online: rest, avatar: image || rest.platform === "Website" ? `/api/listings/avatar?link=${encodeURIComponent(link)}` : null };
}

/**
 * Claim bar: which business a pasted handle or link is.
 * - Already live on this board → bid on it.
 * - Otherwise it's checked online: found (with its name and picture) or unconfirmed → add it
 *   with the bid; not found → refused, so only real accounts and sites can claim a rank.
 * Text that could be a handle or a website ("raj.sojitra17") is checked both ways.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const boardId = params.get("board") ?? "";
  const input = (params.get("link") ?? "").trim().slice(0, 300);
  const candidates = linkCandidates(input);
  if (!boardId || !candidates.length) return NextResponse.json({ error: LINK_HELP }, { status: 400 });

  const onBoard = new Map<string, Awaited<ReturnType<typeof findByLink>>>();
  for (const link of candidates) onBoard.set(link, await findByLink(boardId, link));
  const known = candidates.find((l) => onBoard.get(l));
  const listing = known ? onBoard.get(known)! : null;
  if (listing && BLOCKED.has(listing.status)) {
    return NextResponse.json({ error: `${listing.name} can't take bids right now.` }, { status: 400 });
  }
  const checked = allowOnlineCheck(sessionHash(req));

  if (known && listing?.status === "LIVE") {
    // Already on the board; the online check only adds its picture.
    const avatar = checked ? forBrowser(await checkOnline(known), known).avatar : null;
    return NextResponse.json({ listing: { id: listing.id, name: listing.name }, avatar });
  }

  if (!checked) return NextResponse.json({ error: "Too many checks in a minute. Wait a moment and try again." }, { status: 429 });
  const results = await Promise.all(candidates.map(async (link) => ({ link, online: await checkOnline(link) })));
  // The most likely reading that exists; failing that, one we couldn't confirm (staff check it).
  const pick = results.find((r) => r.online.status === "found") ?? results.find((r) => r.online.status === "unknown");
  if (!pick) {
    const error =
      results.length > 1
        ? `We couldn't find @${input.toLowerCase()} on Instagram or a website at ${input}. Check the spelling.`
        : (results[0].online as Extract<OnlineCheck, { status: "missing" }>).message;
    return NextResponse.json({ error }, { status: 404 });
  }
  const pending = onBoard.get(pick.link);
  return NextResponse.json({
    newBusiness: { link: pick.link, name: pending?.name ?? (pick.online.status === "found" ? (pick.online.name ?? "") : "") },
    ...forBrowser(pick.online, pick.link),
  });
}
