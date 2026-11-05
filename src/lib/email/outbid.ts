import { formatMoney } from "../money";
import { button, C, type Email, esc, eyebrow, fine, layout, para, title } from "./layout";

// Figma 30 "Email · Outbid alert" (FR-ACC-02). Sent to a verified owner whose
// business just lost #1, at most once per business per hour.

export type OutbidEmailData = {
  listingName: string;
  boardLabel: string; // "Surat · Cafes"
  leaderName: string;
  leaderTotal: number; // minor units
  ownTotal: number;
  step: number;
  minBid: number;
  currency: string;
  boardUrl: string;
};

const FOOTER = "Best in the City · Ranked by bids. Order is set by payment, not reviews.";
const FREQUENCY = "At most one alert per business per hour. To stop them, reply to this email.";

/** BR-04: total above − yours + step, and never below the board's minimum bid. */
export const takeBackPrice = (d: Pick<OutbidEmailData, "leaderTotal" | "ownTotal" | "step" | "minBid">) =>
  Math.max(d.minBid, d.leaderTotal - d.ownTotal + d.step);

export function outbidAlertEmail(d: OutbidEmailData): Email {
  const money = (minor: number) => formatMoney(minor, d.currency);
  const amount = takeBackPrice(d);
  const price = money(amount);
  const headline = `${d.listingName} just lost #1 on ${d.boardLabel}`;
  const moved = `${d.leaderName} moved ahead with a total of ${money(d.leaderTotal)}. ${d.listingName} has ${money(d.ownTotal)}.`;
  const sum =
    amount === d.minBid && d.leaderTotal - d.ownTotal + d.step < d.minBid
      ? `the minimum bid of ${money(d.minBid)}`
      : `${money(d.leaderTotal)} − ${money(d.ownTotal)} + ${money(d.step)} step`;
  const initial = esc((d.listingName.trim()[0] ?? "#").toUpperCase());

  const offer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid ${C.accentLine};border-radius:14px;background:${C.accentSoft};border-collapse:separate"><tr>
<td width="44" valign="middle" style="padding:14px 0 14px 16px;width:44px">
<div style="width:44px;height:44px;border-radius:12px;background:${C.accent};font:700 20px/44px Outfit,'Segoe UI',Helvetica,Arial,sans-serif;color:#FFFFFF;text-align:center">${initial}</div>
</td>
<td valign="middle" style="padding:14px 16px 14px 12px">
<p style="margin:0;font:600 15px/20px Outfit,'Segoe UI',Helvetica,Arial,sans-serif;color:${C.ink}">Take #1 back for ${esc(price)}</p>
<p style="margin:0;font:400 13px/19.5px Figtree,'Segoe UI',Helvetica,Arial,sans-serif;color:${C.muted}">${esc(sum)}</p>
</td>
</tr></table>`;

  const content = [eyebrow("Outbid alert"), title(headline), para(esc(moved)), offer, button(d.boardUrl, "Take #1 back"), fine(FREQUENCY)].join("\n");
  const text = [
    "Outbid alert",
    "",
    headline,
    moved,
    "",
    `Take #1 back for ${price} (${sum}): ${d.boardUrl}`,
    "",
    FREQUENCY,
    FOOTER,
  ].join("\n");
  return { subject: headline, html: layout({ subject: headline, preheader: `Take #1 back for ${price}.`, content, footer: FOOTER }), text };
}
