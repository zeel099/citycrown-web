"use server";

import { revalidatePath } from "next/cache";
import type { BoardType } from "@prisma/client";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ActionForm";
import { db } from "@/lib/db";
import { isValidLatLng } from "@/lib/geo";
import { toMinor } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { audit, auditEntry, requireAdmin } from "../staff";

// FR-ADM-01, FR-ADM-06: cities, categories and board settings. Every change is audited.

/** New cities and categories open with an All-time and a Today board, on default settings. */
const NEW_BOARD_TYPES: BoardType[] = ["ALL_TIME", "DAILY"];
const MAX_MAJOR = 1_000_000; // keeps minor units well inside a 32-bit Int

const Toggle = z.object({ id: z.string().min(1), on: z.enum(["true", "false"]).transform((v) => v === "true") });

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** "28.6315, 77.2167", as Google Maps copies a point you right-click. */
const Centre = z.string().transform((s, ctx) => {
  const m = s.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  const at = m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  if (at && isValidLatLng(at)) return at;
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Give the city centre as latitude, longitude, like 28.6315, 77.2167." });
  return z.NEVER;
});

const NewCity = z.object({
  name: z.string().trim().min(2, "Enter the city name.").max(60, "Keep the city name under 60 characters."),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a 2-letter country code, like IN.").transform((s) => s.toUpperCase()),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code, like INR.").transform((s) => s.toUpperCase()),
  timeZone: z.string().trim().min(1, "Enter a time zone, like Asia/Kolkata.").refine(isTimeZone, "Use an IANA time zone, like Asia/Kolkata."),
  centre: Centre, // biases address search and checks business locations are in the city
});

const NewCategory = z.object({
  name: z.string().trim().min(2, "Enter the category name.").max(60, "Keep the category name under 60 characters."),
  banned: z.literal("on").optional(),
});

const money = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number.` }).positive(`${label} must be more than 0.`).max(MAX_MAJOR, `${label} is too high.`);

const BoardSettings = z.object({
  id: z.string().min(1),
  topN: z.coerce.number().int("Top spots must be 5, 6 or 7.").min(5, "Top spots must be 5, 6 or 7.").max(7, "Top spots must be 5, 6 or 7."),
  step: money("Step"),
  minBid: money("Minimum bid"),
  visible: z.literal("on").optional(),
});

const fields = (formData: FormData) => Object.fromEntries(formData);
const firstError = (err: z.ZodError) => err.issues[0]?.message ?? "Check the form and try again.";
const refresh = () => revalidatePath("/admin/settings");

export async function setCityActive(formData: FormData) {
  const actor = await requireAdmin();
  const { id, on } = Toggle.parse(fields(formData));
  const before = await db.city.findUniqueOrThrow({ where: { id } });
  await db.$transaction([
    db.city.update({ where: { id }, data: { active: on } }),
    audit(actor, on ? "city.show" : "city.hide", id, { active: before.active }, { active: on }),
  ]);
  refresh();
}

export async function addCity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = NewCity.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { centre, ...details } = parsed.data;
  const city = { ...details, latitude: centre.lat, longitude: centre.lng, slug: slugify(details.name) };
  if (!city.slug) return { error: "Enter the city name." };
  if (await db.city.findUnique({ where: { slug: city.slug } })) return { error: `${city.name} is already on the list.` };

  const categories = await db.category.findMany({ where: { banned: false }, select: { id: true } });
  const boards = categories.flatMap((c) => NEW_BOARD_TYPES.map((type) => ({ categoryId: c.id, type })));
  await db.$transaction(async (tx) => {
    const created = await tx.city.create({ data: { ...city, boards: { create: boards } } });
    await tx.auditLog.create({ data: auditEntry(actor, "city.add", created.id, undefined, { ...city, boards: boards.length }) });
  });
  refresh();
  return { ok: `${city.name} added with ${boards.length} boards.` };
}

export async function setCategoryActive(formData: FormData) {
  const actor = await requireAdmin();
  const { id, on } = Toggle.parse(fields(formData));
  const before = await db.category.findUniqueOrThrow({ where: { id } });
  await db.$transaction([
    db.category.update({ where: { id }, data: { active: on } }),
    audit(actor, on ? "category.show" : "category.hide", id, { active: before.active }, { active: on }),
  ]);
  refresh();
}

/** FR-LST-04. Allowing a category opens its boards in every city if they don't exist yet. */
export async function setCategoryBanned(formData: FormData) {
  const actor = await requireAdmin();
  const { id, on: banned } = Toggle.parse(fields(formData));
  const before = await db.category.findUniqueOrThrow({ where: { id } });
  const cities = banned ? [] : await db.city.findMany({ select: { id: true } });
  await db.$transaction([
    db.category.update({ where: { id }, data: { banned } }),
    db.board.createMany({
      data: cities.flatMap((c) => NEW_BOARD_TYPES.map((type) => ({ cityId: c.id, categoryId: id, type }))),
      skipDuplicates: true,
    }),
    audit(actor, banned ? "category.ban" : "category.allow", id, { banned: before.banned }, { banned }),
  ]);
  refresh();
}

export async function addCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = NewCategory.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name } = parsed.data;
  const banned = parsed.data.banned === "on";
  const slug = slugify(name);
  if (!slug) return { error: "Enter the category name." };
  if (await db.category.findUnique({ where: { slug } })) return { error: `${name} is already on the list.` };

  const cities = banned ? [] : await db.city.findMany({ select: { id: true } });
  const boards = cities.flatMap((c) => NEW_BOARD_TYPES.map((type) => ({ cityId: c.id, type })));
  await db.$transaction(async (tx) => {
    const created = await tx.category.create({ data: { name, slug, banned, boards: { create: boards } } });
    await tx.auditLog.create({ data: auditEntry(actor, "category.add", created.id, undefined, { name, slug, banned, boards: boards.length }) });
  });
  refresh();
  return { ok: banned ? `${name} added as a banned category.` : `${name} added with ${boards.length} boards.` };
}

/** FR-BRD-03: top spots 5 to 7. Step and minimum bid are entered in major units and stored in minor units. */
export async function saveBoard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = BoardSettings.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, topN, visible } = parsed.data;
  const after = { topN, step: toMinor(parsed.data.step), minBid: toMinor(parsed.data.minBid), active: visible === "on" };
  if (after.step < 1 || after.minBid < 1) return { error: "Amounts must be at least 0.01." };

  const board = await db.board.findUnique({ where: { id } });
  if (!board) return { error: "That board no longer exists." };
  await db.$transaction([
    db.board.update({ where: { id }, data: after }),
    audit(actor, "board.update", id, { topN: board.topN, step: board.step, minBid: board.minBid, active: board.active }, after),
  ]);
  refresh();
  return { ok: "Saved." };
}
