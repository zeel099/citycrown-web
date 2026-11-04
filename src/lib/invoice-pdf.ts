import type { Invoice } from "./invoice-data";
import { GST_RATE } from "./invoices";

// A one-page A4 GST tax invoice as a PDF, attached to the receipt email and
// downloadable from the receipt page. Uses the PDF standard fonts (Helvetica),
// so nothing is embedded; they have no ₹ glyph, so amounts sit under "Amount (INR)".

const W = 595.28;
const H = 841.89;
const M = 50; // page margin

type RGB = [number, number, number];
const hex = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255) as RGB;
const C = { ink: hex("#221E1B"), muted: hex("#736D67"), line: hex("#ECE6DF"), sunken: hex("#F4F1ED"), accent: hex("#E5603F"), good: hex("#1D8150"), white: hex("#FFFFFF") };

// Advance widths (1/1000 em) of the standard Helvetica fonts for characters 32–126.
// prettier-ignore
const REGULAR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
// prettier-ignore
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

/** Text in the fonts' WinAnsi encoding: a few typographic marks are mapped, anything else outside it becomes "?". */
export function winAnsi(s: string): string {
  const map: Record<string, string> = { "→": "->", "₹": "Rs.", "•": "\x95", "–": "\x96", "—": "\x97", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...", " ": " " };
  return [...s].map((ch) => map[ch] ?? (ch.charCodeAt(0) <= 255 ? ch : "?")).join("");
}

function width(text: string, size: number, bold = false): number {
  const table = bold ? BOLD : REGULAR;
  let units = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? table[code - 32] : code === 0xb7 ? 278 : 556;
  }
  return (units * size) / 1000;
}

/** Splits text into lines no wider than maxWidth. */
function wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next, size, bold) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const money = (minor: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);

class Page {
  ops: string[] = [];
  /** y is measured from the top of the page, to the text baseline. */
  text(s: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: RGB; align?: "left" | "right" } = {}) {
    const t = winAnsi(s);
    const left = opts.align === "right" ? x - width(t, size, opts.bold) : x;
    const esc = t.replace(/[\\()]/g, (c) => `\\${c}`);
    const [r, g, b] = opts.color ?? C.ink;
    this.ops.push(`BT /${opts.bold ? "F2" : "F1"} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${left.toFixed(2)} ${(H - y).toFixed(2)} Td (${esc}) Tj ET`);
  }
  rect(x: number, y: number, w: number, h: number, color: RGB) {
    this.ops.push(`${color.map((c) => c.toFixed(3)).join(" ")} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  line(x1: number, y: number, x2: number, color: RGB = C.line, w = 0.75) {
    this.ops.push(`${color.map((c) => c.toFixed(3)).join(" ")} RG ${w} w ${x1.toFixed(2)} ${(H - y).toFixed(2)} m ${x2.toFixed(2)} ${(H - y).toFixed(2)} l S`);
  }
}

export function invoicePdf(inv: Invoice): Buffer {
  const p = new Page();
  const right = W - M;

  // Brand and title
  p.rect(M, 46, 28, 28, C.accent);
  p.text("#1", M + 5.5, 64.5, 11, { bold: true, color: C.white });
  p.text("Best in the City", M + 38, 60, 16, { bold: true });
  p.text("Ranked by bids", M + 38, 73, 8.5, { color: C.muted });
  p.text(inv.gst ? "TAX INVOICE" : "RECEIPT", right, 58, 17, { bold: true, color: C.accent, align: "right" });
  p.text(inv.invoiceNo, right, 74, 10.5, { bold: true, align: "right" });
  p.line(M, 96, right);

  // Seller (left) and invoice details (right)
  const label = (s: string, x: number, y: number) => p.text(s.toUpperCase(), x, y, 7.5, { bold: true, color: C.muted });
  let y = 118;
  label("Sold by", M, y);
  y += 15;
  for (const l of wrap(inv.seller.name, 10.5, 240, true)) {
    p.text(l, M, y, 10.5, { bold: true });
    y += 14;
  }
  for (const l of inv.seller.address ? wrap(inv.seller.address, 9, 240) : []) {
    p.text(l, M, y, 9, { color: C.muted });
    y += 12;
  }
  if (inv.gst) p.text(`GSTIN: ${inv.seller.gstin ?? "Not set"}`, M, y + 2, 9);
  const sellerBottom = y + 14;

  const col = 330;
  const detail = (k: string, v: string, at: number, color?: RGB) => {
    label(k, col, at);
    p.text(v, col, at + 14, 10, { bold: true, color });
  };
  detail("Invoice date", inv.dateLabel, 118);
  detail("Billed to", inv.billedTo, 152);
  detail("Status", inv.status, 186, inv.status === "Paid" ? C.good : C.muted);

  // Line items
  y = Math.max(sellerBottom, 216) + 18;
  p.rect(M, y, right - M, 24, C.sunken);
  p.text("DESCRIPTION", M + 10, y + 15.5, 7.5, { bold: true, color: C.muted });
  p.text(`AMOUNT (${inv.currency})`, right - 10, y + 15.5, 7.5, { bold: true, color: C.muted, align: "right" });
  y += 24;

  const row = (desc: string, amount: string, bold = false) => {
    const lines = wrap(desc, 10, 330, bold);
    lines.forEach((l, i) => p.text(l, M + 10, y + 17 + i * 13, 10, { bold }));
    p.text(amount, right - 10, y + 17, 10, { bold, align: "right" });
    y += 12 + lines.length * 13;
    p.line(M, y, right);
  };
  row(inv.description, money(inv.taxable));
  if (inv.gst) row(`GST @ ${GST_RATE}%`, money(inv.tax));
  y += 2;
  p.line(M, y, right, C.ink, 1);
  p.text("Total paid", M + 10, y + 18, 11, { bold: true });
  p.text(money(inv.amount), right - 10, y + 18, 11, { bold: true, align: "right" });
  y += 30;
  p.line(M, y, right, C.ink, 1);

  // Total in words and notes
  y += 22;
  label("Amount in words", M, y);
  for (const l of wrap(inv.amountInWords, 10, right - M)) {
    y += 14;
    p.text(l, M, y, 10);
  }
  y += 28;
  const notes = [
    inv.gst ? `Amounts include GST at ${GST_RATE}%.` : "",
    "Bids are final and non-refundable. Rank on the board is set by the total amount paid and can change as others bid.",
    "This is a computer-generated invoice and needs no signature.",
  ].filter(Boolean);
  for (const note of notes) {
    for (const l of wrap(note, 8.5, right - M)) {
      p.text(l, M, y, 8.5, { color: C.muted });
      y += 11.5;
    }
    y += 3;
  }

  // Footer
  p.line(M, H - 70, right);
  p.text(`View online: ${inv.receiptUrl}`, M, H - 54, 8, { color: C.muted });
  p.text("Best in the City · Order on every board is set by payment, not by quality or reviews.", M, H - 42, 8, { color: C.muted });

  return build(p.ops.join("\n"), `Tax invoice ${inv.invoiceNo}`);
}

/** Assembles a single-page PDF 1.4 file around a content stream. */
function build(content: string, title: string): Buffer {
  const date = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title (${winAnsi(title).replace(/[\\()]/g, (c) => `\\${c}`)}) /Producer (Best in the City) /CreationDate (D:${date}Z) >>`,
  ];
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character is a single WinAnsi byte, so string offsets are byte offsets.
  return Buffer.from(out, "latin1");
}
