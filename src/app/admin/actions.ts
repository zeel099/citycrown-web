"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ListingStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { refreshProfile } from "@/lib/avatars";
import { siteUrl, verificationResultEmail } from "@/lib/email";
import { fillMissingBoards, listingUrl, recordLinkCheck, sameBusiness } from "@/lib/listings";
import { checkLocation, locationFromForm, saveLocation } from "@/lib/locations";
import { sendMail } from "@/lib/mailer";
import { markVerified, METHODS, rejectVerification } from "@/lib/verification";
import { audit, requireAdmin } from "./staff";

const Id = z.object({ id: z.string().min(1) });
const WithReason = Id.extend({ reason: z.string().trim().max(200).optional() });
const read = <T extends z.ZodTypeAny>(schema: T, formData: FormData): z.infer<T> => schema.parse(Object.fromEntries(formData));

/**
 * Moderation applies to the business on every board of its city and category, so
 * All-time and Today never disagree. Logged with who did it and the before/after state (FR-ADM-02).
 */
async function setStatus(actor: string, listingId: string, status: ListingStatus, from: ListingStatus[], reason: string | null) {
  const listing = await db.listing.findUniqueOrThrow({ where: { id: listingId }, include: { board: true } });
  const affected = await db.listing.findMany({ where: { ...sameBusiness(listing), status: { in: from } }, select: { id: true } });
  const ids = affected.map((l) => l.id);
  await db.$transaction([
    db.listing.updateMany({ where: { id: { in: ids } }, data: { status, rejectReason: reason } }),
    audit(actor, `listing.${status.toLowerCase()}`, listingId, { status: listing.status }, { status, reason, listingIds: ids }),
  ]);
  revalidatePath("/admin");
}

export async function approveListing(formData: FormData) {
  const actor = await requireAdmin();
  const { id } = read(Id, formData);
  await fillMissingBoards(id);
  await setStatus(actor, id, "LIVE", ["PENDING"], null);
  after(() => refreshProfile(id)); // its picture for the board
}

export async function rejectListing(formData: FormData) {
  const actor = await requireAdmin();
  const { id, reason } = read(WithReason, formData);
  await setStatus(actor, id, "REJECTED", ["PENDING"], reason || "Didn't meet listing rules");
}

export async function freezeListing(formData: FormData) {
  const actor = await requireAdmin();
  const { id, reason } = read(WithReason, formData);
  await setStatus(actor, id, "FROZEN", ["LIVE", "PENDING"], reason || "Under review after a report");
}

/** FR-ADM-03: runs the link check again for the business's listings. */
export async function recheckLink(formData: FormData) {
  const actor = await requireAdmin();
  const listing = await db.listing.findUniqueOrThrow({ where: { id: read(Id, formData).id }, include: { board: true } });
  const url = listingUrl(listing);
  if (!url) return;
  const siblings = await db.listing.findMany({ where: sameBusiness(listing), select: { id: true } });
  const result = await recordLinkCheck(siblings.map((l) => l.id), url);
  await audit(actor, "listing.link_check", listing.id, { ok: listing.linkCheckOk, note: listing.linkCheckNote }, result ?? undefined);
  revalidatePath("/admin");
}

export async function resolveReport(formData: FormData) {
  const actor = await requireAdmin();
  const { id } = read(Id, formData);
  const before = await db.report.findUniqueOrThrow({ where: { id } });
  await db.$transaction([
    db.report.update({ where: { id }, data: { status: "RESOLVED" } }),
    audit(actor, "report.resolved", id, { status: before.status }, { status: "RESOLVED" }),
  ]);
  revalidatePath("/admin");
}

/** Staff found the code on the page the automatic check couldn't read. */
export async function verifyOwner(formData: FormData) {
  const actor = await requireAdmin();
  const { id } = read(Id, formData);
  await markVerified(id, actor);
  after(() => notifyOwner(id));
  revalidatePath("/admin");
}

export async function rejectOwner(formData: FormData) {
  const actor = await requireAdmin();
  const { id, reason } = read(WithReason, formData);
  await rejectVerification(id, actor, reason || "Code not found on the page");
  after(() => notifyOwner(id));
  revalidatePath("/admin");
}

/** The in-review screen promises an email once staff have decided. */
async function notifyOwner(verificationId: string) {
  try {
    const v = await db.verification.findUniqueOrThrow({
      where: { id: verificationId },
      include: { user: true, listing: { include: { board: { include: { city: true, category: true } } } } },
    });
    if (!v.user?.email) return;
    const verified = v.status === "VERIFIED";
    await sendMail(
      v.user.email,
      verificationResultEmail({
        listingName: v.listing.name,
        method: METHODS[v.method].label,
        verified,
        reason: verified ? null : v.lastCheckNote,
        url: siteUrl(verified ? `/${v.listing.board.city.slug}/${v.listing.board.category.slug}` : `/verify/${v.listingId}`),
      }),
    );
  } catch (err) {
    console.error("[mail] verification result", err);
  }
}

/** Adds or corrects a business's location, on every board it's on. */
export async function setListingLocation(formData: FormData) {
  const actor = await requireAdmin();
  const { id } = read(Id, formData);
  const listing = await db.listing.findUniqueOrThrow({ where: { id }, include: { board: { include: { city: true } } } });
  const place = checkLocation(locationFromForm(formData), listing.board.city);
  await saveLocation(id, place);
  await audit(actor, "listing.location", id, { address: listing.address, lat: listing.latitude, lng: listing.longitude }, { address: place.address, lat: place.lat, lng: place.lng });
  revalidatePath("/admin");
}
