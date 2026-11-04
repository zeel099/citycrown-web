import { after, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { recordLinkCheck, submitListing } from "@/lib/listings";
import { LocationInput } from "@/lib/locations";

const Body = z.object({
  city: z.string().min(1, { message: "Choose a city." }).max(80),
  category: z.string().min(1, { message: "Choose a category." }).max(80),
  name: z.string().max(80, { message: "Keep the business name under 80 characters." }),
  link: z.string().max(300),
  email: z.string().trim().email({ message: "Enter a valid email." }).optional().nullable(),
  location: LocationInput.nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const { listings, url, city, category } = await submitListing(Body.parse(await req.json()));
    // FR-ADM-03: the link check runs after the response, so a slow or broken site never blocks a submission.
    const ids = listings.map((l) => l.id);
    after(() => recordLinkCheck(ids, url));
    return NextResponse.json({ ids, status: "PENDING", city, category }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
