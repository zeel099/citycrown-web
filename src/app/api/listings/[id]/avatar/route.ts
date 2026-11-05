import { db } from "@/lib/db";

/** A business's saved picture for the board. The URL carries a version, so it can be cached for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const avatar = await db.listingAvatar.findUnique({ where: { listingId: id } });
  if (!avatar) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "content-type": avatar.type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
