import crypto from "node:crypto";

const BOT = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slurp/i;

export function isBot(req: Request): boolean {
  return BOT.test(req.headers.get("user-agent") ?? "");
}

/** A daily, non-reversible visitor hash for de-duplicating counts; no IP is stored. day defaults to the UTC date. */
export function sessionHash(req: Request, day = new Date().toISOString().slice(0, 10)): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return crypto.createHash("sha256").update(`${ip}|${req.headers.get("user-agent") ?? ""}|${day}`).digest("hex").slice(0, 32);
}
