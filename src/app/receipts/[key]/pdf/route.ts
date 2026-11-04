import { invoiceByKey } from "@/lib/invoice-data";
import { invoicePdf } from "@/lib/invoice-pdf";

/** The GST tax invoice as a PDF, from the private receipt link (the same file the receipt email attaches). */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const inv = await invoiceByKey(key);
  if (!inv) return new Response("Receipt not found", { status: 404 });
  return new Response(new Uint8Array(invoicePdf(inv)), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${inv.fileName}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
