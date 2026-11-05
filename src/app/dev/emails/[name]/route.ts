import { emailPreviews } from "@/lib/email";

/** Development preview of an email template with sample data; ?text shows the plain-text version. */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { name } = await params;
  const render = Object.hasOwn(emailPreviews, name) ? emailPreviews[name] : undefined;
  if (!render) return new Response("Not found", { status: 404 });
  const email = render();
  const text = new URL(req.url).searchParams.has("text");
  return new Response(text ? `Subject: ${email.subject}\n\n${email.text}` : email.html, {
    headers: { "content-type": `${text ? "text/plain" : "text/html"}; charset=utf-8`, "cache-control": "no-store" },
  });
}
