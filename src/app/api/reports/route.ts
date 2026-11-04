import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, UserError } from "@/lib/http";

const Body = z.object({
  listingId: z.string().min(1),
  reason: z.string().trim().min(3, { message: "Tell us what's wrong." }).max(500),
  reporterContact: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => v || null),
});

/** FR-LST-06: any user can report a listing; it lands in the moderation queue. */
export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const listing = await db.listing.findUnique({ where: { id: body.listingId }, select: { id: true } });
    if (!listing) throw new UserError("This listing is no longer on the board.");
    const report = await db.report.create({ data: body });
    return NextResponse.json({ id: report.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
