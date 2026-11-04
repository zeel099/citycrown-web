import { emailPreviews } from "@/lib/email";

/** Development index of email previews. */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const items = Object.keys(emailPreviews)
    .map((name) => `<li><a href="/dev/emails/${name}">${name}</a> · <a href="/dev/emails/${name}?text">text</a></li>`)
    .join("");
  return new Response(`<!doctype html><meta charset="utf-8"><title>Email previews</title><h1>Email previews</h1><ul>${items}</ul>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
