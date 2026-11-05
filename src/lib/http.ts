import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BidError } from "./bids";

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  if (err instanceof BidError || err instanceof UserError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Try again in a minute." }, { status: 500 });
}

export class UserError extends Error {}
