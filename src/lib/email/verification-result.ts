import { button, type Email, esc, eyebrow, fine, layout, para, title } from "./layout";

// Sent when staff finish a verification the automatic check couldn't read
// (the in-review screen promises "We'll email you when it's done").

export type VerificationResultData = {
  listingName: string;
  method: string; // "Instagram"
  verified: boolean;
  reason?: string | null;
  url: string; // the board, or the verify page to try again
};

const FOOTER = "Best in the City · Ranked by bids. Order is set by payment, not reviews.";

export function verificationResultEmail(d: VerificationResultData): Email {
  const headline = d.verified ? `${d.listingName} is verified` : `We couldn't verify ${d.listingName}`;
  const body = d.verified
    ? `We found your code on ${d.method}. ${d.listingName} now shows the Verified badge on every board it's on.`
    : `We didn't find your code on ${d.method}${d.reason ? ` (${d.reason})` : ""}. Add it again and send it for review, or use another link.`;
  const cta = d.verified ? "See the board" : "Try again";
  const content = [
    eyebrow("Verification"),
    title(headline),
    para(esc(body)),
    button(d.url, cta),
    ...(d.verified ? [fine("You can remove the code from your profile now.")] : []),
  ].join("\n");
  const text = [headline, "", body, "", `${cta}: ${d.url}`, "", FOOTER].join("\n");
  return { subject: headline, html: layout({ subject: headline, preheader: body, content, footer: FOOTER }), text };
}
