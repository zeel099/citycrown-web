import { NextResponse } from "next/server";
import { z } from "zod";
import { createBid } from "@/lib/bids";
import { errorResponse } from "@/lib/http";
import { LocationInput } from "@/lib/locations";
import { toMinor } from "@/lib/money";

const Common = {
  amount: z.number().positive({ message: "Enter an amount." }), // major units, e.g. rupees
  email: z.string().email({ message: "Enter a valid email for your receipt." }),
  displayName: z.string().max(40).optional().nullable(),
  acceptedTerms: z.boolean(),
};

// A bid on a business already on the board, or on one pasted into the claim bar by its link.
const Body = z.union([
  z.object({ ...Common, listingId: z.string().min(1) }),
  z.object({
    ...Common,
    newBusiness: z.object({
      boardId: z.string().min(1),
      name: z.string().trim().min(1, { message: "Add your business name." }).max(80, { message: "Keep the business name under 80 characters." }),
      link: z.string().min(1).max(300),
      location: LocationInput.nullable().optional(), // required for a business that isn't on the board yet
    }),
  }),
]);

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const target = "listingId" in body ? { listingId: body.listingId } : body.newBusiness;
    const result = await createBid({ ...body, target, amount: toMinor(body.amount) });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
