import { outboxMail } from "@/lib/mailer";

/** Development: an attachment from an outbox email, e.g. the invoice PDF. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { id, file } = await params;
  const attachment = outboxMail().find((m) => m.id === id)?.attachments[Number(file)];
  if (!attachment) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(attachment.content), {
    headers: {
      "content-type": attachment.contentType,
      "content-disposition": `inline; filename="${attachment.filename}"`,
      "cache-control": "no-store",
    },
  });
}
