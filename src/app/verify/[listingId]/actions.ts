"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { locationFromForm } from "@/lib/locations";
import { normalizeEmail } from "@/lib/mailer";
import { methodFromSlug, requestManualReview, runVerificationCheck } from "@/lib/verification";

const Email = z.string().trim().email().max(200);

function read(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const raw = String(formData.get("email") ?? "");
  const email = Email.safeParse(raw).success ? normalizeEmail(raw) : null;
  return { listingId, method: methodFromSlug(String(formData.get("method") ?? "")), email, location: locationFromForm(formData) };
}

/** "Check now": looks for the code on the listing's own link (FR-LST-05). No account needed. */
export async function checkNow(formData: FormData) {
  const { listingId, method, email, location } = read(formData);
  if (!listingId || !method) return;
  await runVerificationCheck(listingId, method, email, location);
  revalidatePath(`/verify/${listingId}`);
}

/** "Send for review": a social profile we couldn't read goes to the admin queue. */
export async function sendForReview(formData: FormData) {
  const { listingId, method, email, location } = read(formData);
  if (!listingId || !method) return;
  await requestManualReview(listingId, method, email, location);
  revalidatePath(`/verify/${listingId}`);
}
