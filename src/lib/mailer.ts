import crypto from "node:crypto";
import nodemailer from "nodemailer";
import type { Email } from "./email";

// Transactional email. Sends through Resend's HTTP API when RESEND_API_KEY is set, otherwise through any SMTP
// server when SMTP_HOST, SMTP_USER and SMTP_PASS are set (e.g. Gmail with an app password).
// Development also keeps every message, delivered or not, in an outbox you can open at /dev/outbox.
// Without a provider, development only keeps it there (and prints a line to the console);
// production logs a warning and sends nothing.

const DEFAULT_NAME = "Best in the City";

export type Attachment = { filename: string; content: Buffer; contentType: string };

export type OutboxMail = Email & {
  id: string;
  to: string;
  at: Date;
  attachments: Attachment[];
  /** When the provider accepted it; null while it has only been kept here. */
  sentAt?: Date | null;
  /** Why the last delivery failed. */
  error?: string | null;
};

type Provider = { kind: "resend"; key: string } | { kind: "smtp"; host: string; port: number; user: string; pass: string };

const store = globalThis as unknown as { __bitcOutbox?: OutboxMail[] };
const outbox = (store.__bitcOutbox ??= []);
const OUTBOX_SIZE = 50;

/** The service set up in .env to deliver email, or null. */
function provider(): Provider | null {
  if (process.env.RESEND_API_KEY) return { kind: "resend", key: process.env.RESEND_API_KEY };
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop"); they work without the spaces.
  const gmail = /(^|\.)(gmail|googlemail)\.com$/i.test(host);
  return { kind: "smtp", host, port: Number(process.env.SMTP_PORT) || 465, user, pass: gmail ? pass.replace(/\s+/g, "") : pass };
}

/** How email goes out, for the development outbox: "smtp.gmail.com as you@gmail.com", "Resend", or null when it doesn't. */
export function mailStatus(): string | null {
  const p = provider();
  return !p ? null : p.kind === "resend" ? "Resend" : `${p.host} as ${p.user}`;
}

/** Messages sent in development, newest first. */
export function outboxMail(): readonly OutboxMail[] {
  return outbox;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function sendMail(to: string, email: Email, attachments: Attachment[] = []): Promise<void> {
  const p = provider();
  const dev = process.env.NODE_ENV !== "production";
  if (!p && !dev) {
    console.warn("[mail] no email provider is set up (RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS); email not sent");
    return;
  }
  const kept: OutboxMail | null = dev
    ? { ...email, id: crypto.randomBytes(6).toString("hex"), to, at: new Date(), attachments, sentAt: null, error: null }
    : null;
  if (kept) {
    outbox.unshift(kept);
    outbox.length = Math.min(outbox.length, OUTBOX_SIZE);
  }
  if (!p) {
    const files = attachments.length ? ` (+ ${attachments.map((a) => a.filename).join(", ")})` : "";
    console.info(
      `[mail] not sent, no email provider. To ${to}: ${email.subject}${files}. Open it at ${process.env.APP_URL || "http://localhost:3000"}/dev/outbox\n${email.text}`,
    );
    return;
  }
  await deliver(p, to, email, attachments, kept);
}

/** Development: delivers a message kept in the outbox through the provider now set up. The outbox shows how it went. */
export async function sendFromOutbox(id: string): Promise<void> {
  const mail = outbox.find((m) => m.id === id);
  if (!mail) return;
  const p = provider();
  if (!p) {
    mail.error = "No email provider is set up in .env.";
    return;
  }
  await deliver(p, mail.to, mail, mail.attachments, mail).catch(() => {});
}

async function deliver(p: Provider, to: string, email: Email, attachments: Attachment[], kept: OutboxMail | null): Promise<void> {
  try {
    if (p.kind === "smtp") await sendSmtp(p, to, email, attachments);
    else await sendResend(p.key, to, email, attachments);
    if (kept) {
      kept.sentAt = new Date();
      kept.error = null;
    }
  } catch (err) {
    if (kept) kept.error = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

function fromAddress(p: Provider): string {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  // SMTP servers like Gmail send only from the signed-in account's own address.
  return p.kind === "smtp" && p.user.includes("@") ? `${DEFAULT_NAME} <${p.user}>` : `${DEFAULT_NAME} <no-reply@localhost>`;
}

async function sendSmtp(p: Extract<Provider, { kind: "smtp" }>, to: string, email: Email, attachments: Attachment[]): Promise<void> {
  const secure = p.port === 465;
  const transport = nodemailer.createTransport({
    host: p.host,
    port: p.port,
    secure,
    // On other ports, insist on STARTTLS so the password never crosses the network in the clear.
    requireTLS: !secure && !/^(localhost|127\.0\.0\.1|::1)$/i.test(p.host),
    auth: { user: p.user, pass: p.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  try {
    await transport.sendMail({
      from: fromAddress(p),
      to,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
  } finally {
    transport.close();
  }
}

async function sendResend(key: string, to: string, email: Email, attachments: Attachment[]): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: fromAddress({ kind: "resend", key }),
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {}),
      ...(attachments.length
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_type: a.contentType })) }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
