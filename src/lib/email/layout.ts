// Shared frame for transactional emails (Figma 28–30): 640px wide, table layout,
// inline styles only, so Gmail, Outlook and Apple Mail render it the same way.

export type Email = { subject: string; html: string; text: string };

export const C = {
  bg: "#FBF9F7",
  surface: "#FFFFFF",
  line: "#ECE6DF",
  ink: "#221E1B",
  muted: "#736D67",
  accent: "#E5603F",
  accentSoft: "#FBE8E1",
  accentLine: "#F5D3C7",
};

const HEAD = "Outfit,'Segoe UI',Helvetica,Arial,sans-serif";
const BODY = "Figtree,'Segoe UI',Helvetica,Arial,sans-serif";

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Absolute link into the site for emails. */
export function siteUrl(path: string): string {
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

export const eyebrow = (text: string) =>
  `<p style="margin:0 0 16px;font:600 12px/18px ${BODY};letter-spacing:.1em;text-transform:uppercase;color:${C.muted}">${esc(text)}</p>`;

export const title = (text: string) =>
  `<h1 style="margin:0 0 16px;font:700 28px/42px ${HEAD};letter-spacing:-.01em;color:${C.ink}">${esc(text)}</h1>`;

/** `html` must already be escaped. */
export const para = (html: string) => `<p style="margin:0 0 16px;font:400 16px/24px ${BODY};color:${C.ink}">${html}</p>`;

export const fine = (text: string) => `<p style="margin:0;font:400 13px/19.5px ${BODY};color:${C.muted}">${esc(text)}</p>`;

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr>
<td style="border-radius:999px;background:${C.accent}"><a href="${esc(href)}" style="display:inline-block;padding:15px 22px;border-radius:999px;font:600 15px/15px ${HEAD};color:#FFFFFF;text-decoration:none">${esc(label)}</a></td>
</tr></table>`;
}

/** Label/amount rows with the last row bold, e.g. taxable value, GST, total paid. */
export function amountTable(rows: [string, string][]): string {
  const cells = rows
    .map(([label, amount], i) => {
      const last = i === rows.length - 1;
      const border = i === 0 ? "" : `border-top:1px solid ${C.line};`;
      const weight = last ? 600 : 400;
      return `<tr>
<td style="${border}padding:10px 12px;font:${weight} 15px/22px ${BODY};color:${C.ink}">${esc(label)}</td>
<td align="right" style="${border}padding:10px 12px;font:${weight} 15px/22px ${BODY};color:${C.ink};white-space:nowrap">${esc(amount)}</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid ${C.line};border-radius:12px;border-collapse:separate">${cells}</table>`;
}

export function layout(opts: { subject: string; preheader: string; content: string; footer: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 0 20px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;border-radius:10px;background:${C.accent};font:800 14px/34px ${HEAD};letter-spacing:-.03em;color:#FFFFFF">#1</td>
<td style="padding-left:10px;font:700 22px/28px ${HEAD};letter-spacing:-.02em;color:${C.ink}">Best in the City</td>
</tr></table>
</td></tr>
<tr><td style="padding:22px;border:1px solid ${C.line};border-radius:18px;background:${C.surface}">
${opts.content}
</td></tr>
<tr><td align="center" style="padding:20px 0 0;font:400 13px/19.5px ${BODY};color:${C.muted}">${esc(opts.footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
