import { describe, expect, it } from "vitest";
import type { Invoice } from "./invoice-data";
import { invoicePdf, winAnsi } from "./invoice-pdf";

const invoice: Invoice = {
  invoiceNo: "BITC/2627/000005",
  fileName: "Invoice-BITC-2627-000005.pdf",
  issuedAt: new Date("2026-11-02T06:51:00Z"),
  dateLabel: "2 Nov 2026, 12:21 pm",
  status: "Paid",
  billedTo: "you@example.com",
  seller: { name: "Best in the City Pvt Ltd", gstin: "24ABCDE1234F1Z5", address: "Ring Road, Surat, Gujarat 395002", nameSet: true },
  listingName: "Chai & Chapter (Café)",
  boardLabel: "Mumbai → Restaurants",
  description: "Bid on Chai & Chapter (Café), Mumbai → Restaurants board",
  currency: "INR",
  amount: 141000,
  taxable: 119492,
  tax: 21508,
  gst: true,
  amountInWords: "Rupees One Thousand Four Hundred Ten Only",
  receiptUrl: "http://localhost:3000/receipts/abc",
  pdfUrl: "http://localhost:3000/receipts/abc/pdf",
};

describe("invoicePdf", () => {
  const pdf = invoicePdf(invoice).toString("latin1");

  it("is a complete PDF whose cross-reference table points at each object", () => {
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(7);
    offsets.forEach((offset, i) => expect(pdf.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    const length = Number(pdf.match(/<< \/Length (\d+) >>\nstream\n/)![1]);
    const start = pdf.indexOf("stream\n") + "stream\n".length;
    expect(pdf.slice(start + length, start + length + "\nendstream".length)).toBe("\nendstream");
  });

  it("prints the invoice details and amounts", () => {
    for (const s of ["TAX INVOICE", "BITC/2627/000005", "you@example.com", "GSTIN: 24ABCDE1234F1Z5", "1,194.92", "215.08", "1,410.00", "Rupees One Thousand Four Hundred Ten Only"]) {
      expect(pdf).toContain(s);
    }
    expect(pdf).toContain("Mumbai -> Restaurants");
    expect(pdf).toContain("Caf\xe9"); // é is in WinAnsi
  });
});

it("maps text the standard PDF fonts can't show", () => {
  expect(winAnsi("₹100 → ok • 日本")).toBe("Rs.100 -> ok \x95 ??");
});
