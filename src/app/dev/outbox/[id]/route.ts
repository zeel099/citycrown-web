import { outboxMail, sendFromOutbox } from "@/lib/mailer";

/** Development: one email from the outbox, as the recipient would see it (?text for the plain version). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { id } = await params;
  const mail = outboxMail().find((m) => m.id === id);
  if (!mail) return new Response("Not found", { status: 404 });
  const text = new URL(req.url).searchParams.has("text");
  return new Response(text ? mail.text : mail.html, {
    headers: { "content-type": text ? "text/plain; charset=utf-8" : "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Development: delivers this email to its recipient through the provider in .env, then back to the outbox. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  if (req.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  await sendFromOutbox((await params).id);
  return Response.redirect(new URL("/dev/outbox", req.url), 303);
}
