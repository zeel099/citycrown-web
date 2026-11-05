import { parseBusinessLink } from "@/lib/business-link";
import { sessionHash } from "@/lib/events";
import { avatarFor } from "@/lib/online-check";
import { allowOnlineCheck } from "@/lib/rate-limit";

/**
 * Claim bar: the profile picture or site icon of a business link.
 * Served from here so visitors' browsers never call Instagram or Facebook directly.
 */
export async function GET(req: Request) {
  const link = parseBusinessLink((new URL(req.url).searchParams.get("link") ?? "").slice(0, 300));
  const image = link ? await avatarFor(link, () => allowOnlineCheck(sessionHash(req))) : null;
  if (!image) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "content-type": image.type,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
