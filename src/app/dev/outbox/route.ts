import { esc } from "@/lib/email/layout";
import { mailStatus, outboxMail } from "@/lib/mailer";

/** Development: every email the app sent, newest first, with whether it was delivered and a button to send it now. */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const time = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const status = mailStatus();
  const rows = outboxMail()
    .map((m) => {
      const files = m.attachments
        .map((a, i) => `<a href="/dev/outbox/${m.id}/${i}">${esc(a.filename)}</a>`)
        .join(" ");
      const send = status
        ? `<form method="post" action="/dev/outbox/${m.id}"><button>${m.error ? "Try again" : m.sentAt ? "Send again" : "Send"}</button></form>`
        : "";
      const state = m.sentAt
        ? `<span class="ok">Delivered ${esc(time.format(m.sentAt))}</span>`
        : m.error
          ? `<span class="err">Not delivered: ${esc(m.error)}${esc(errorHint(m.error))}</span>`
          : `<span class="muted">Not sent</span>`;
      return `<tr><td>${esc(time.format(m.at))}</td><td>${esc(m.to)}</td><td><a href="/dev/outbox/${m.id}"><b>${esc(m.subject)}</b></a></td><td>${files || "–"}</td><td>${state}${send}</td></tr>`;
    })
    .join("");
  const body = rows
    ? `<table><thead><tr><th>Time</th><th>To</th><th>Subject</th><th>Attachments</th><th>Delivery</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p>No emails yet. Place a bid on any board and its receipt will appear here.</p>`;
  const banner = status
    ? `<p class="banner on">Email is on: sending through ${esc(status)}. Anything listed as "Not sent" was kept before it was set up; press Send to deliver it.</p>`
    : `<p class="banner off"><b>Email is off, so nothing below was delivered.</b> To send real email, fill SMTP_USER and SMTP_PASS in .env and save
(for Gmail, SMTP_PASS is an app password from <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">myaccount.google.com/apppasswords</a>, not your normal password).
Then reload this page and press Send next to a message.</p>`;
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outbox</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:32px auto;max-width:1100px;padding:0 16px;color:#221E1B;background:#FBF9F7}
h1{font-size:24px;margin:0 0 4px}p{color:#736D67}.table{overflow-x:auto}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #ECE6DF}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #ECE6DF;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#736D67}a{color:#C94B2C}
.banner{padding:12px 14px;border-radius:10px;color:#221E1B}.banner.on{background:#E6F4EA}.banner.off{background:#FDF0E6}
.ok{color:#1E7B3C}.err{color:#B3261E}.muted{color:#736D67}td form{margin-top:6px}
button{font:inherit;font-size:14px;padding:5px 12px;border:1px solid #C94B2C;border-radius:8px;background:#C94B2C;color:#fff;cursor:pointer}</style>
<h1>Outbox</h1><p>Every email the app sent in development, newest first (last 50).</p>${banner}<div class="table">${body}</div>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

/** A next step for the usual SMTP failures. */
function errorHint(error: string): string {
  if (/invalid login|535|username and password not accepted|authentication/i.test(error)) {
    return " Check SMTP_USER and SMTP_PASS. Gmail needs an app password here (with 2-Step Verification on), not your normal password.";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|timeout/i.test(error)) return " Couldn't reach the mail server: check SMTP_HOST and SMTP_PORT.";
  return "";
}
