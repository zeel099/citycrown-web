import net from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mailStatus, outboxMail, sendFromOutbox, sendMail } from "./mailer";

type Received = { from: string; to: string[]; auth: string; data: string };

/** A tiny SMTP server that keeps what it receives and turns down the password "wrong". */
function smtpSink() {
  const received: Received[] = [];
  const server = net.createServer((socket) => {
    let buf = "";
    let reading = false;
    let msg: Received = { from: "", to: [], auth: "", data: "" };
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply("220 sink ESMTP");
    socket.on("data", (chunk) => {
      buf += chunk.toString("latin1");
      for (;;) {
        if (reading) {
          const end = buf.indexOf("\r\n.\r\n");
          if (end < 0) return;
          received.push({ ...msg, data: buf.slice(0, end) });
          buf = buf.slice(end + 5);
          msg = { from: "", to: [], auth: msg.auth, data: "" };
          reading = false;
          reply("250 queued");
          continue;
        }
        const i = buf.indexOf("\r\n");
        if (i < 0) return;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const verb = line.split(" ")[0].toUpperCase();
        if (verb === "EHLO") reply("250-sink\r\n250-AUTH PLAIN\r\n250 8BITMIME");
        else if (verb === "AUTH") {
          msg.auth = Buffer.from(line.split(" ")[2] ?? "", "base64").toString().split("\0").slice(1).join(":");
          reply(msg.auth.endsWith(":wrong") ? "535 5.7.8 Username and Password not accepted" : "235 2.7.0 Accepted");
        } else if (verb === "MAIL") (msg.from = line), reply("250 OK");
        else if (verb === "RCPT") msg.to.push(line), reply("250 OK");
        else if (verb === "DATA") (reading = true), reply("354 go ahead");
        else if (verb === "QUIT") reply("221 bye"), socket.end();
        else reply("250 OK");
      }
    });
  });
  return { server, received };
}

const sink = smtpSink();
let port = 0;
beforeAll(async () => {
  await new Promise<void>((resolve) => sink.server.listen(0, "127.0.0.1", resolve));
  port = (sink.server.address() as net.AddressInfo).port;
});
afterAll(() => new Promise<void>((resolve) => sink.server.close(() => resolve())));
afterEach(() => vi.unstubAllEnvs());

function useSmtp(pass: string) {
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SMTP_HOST", "127.0.0.1");
  vi.stubEnv("SMTP_PORT", String(port));
  vi.stubEnv("SMTP_USER", "shop@example.com");
  vi.stubEnv("SMTP_PASS", pass);
  vi.stubEnv("MAIL_FROM", "");
}

const email = { subject: "Your receipt BITC/2627/000001", html: "<!doctype html><p>Paid</p>", text: "Paid" };
const pdf = { filename: "Invoice-BITC-2627-000001.pdf", content: Buffer.from("%PDF-1.4 test"), contentType: "application/pdf" };

describe("sendMail over SMTP", () => {
  it("delivers with the attachment, from the SMTP account, and marks it delivered in the outbox", async () => {
    useSmtp("abcd efgh ijkl mnop");
    expect(mailStatus()).toBe("127.0.0.1 as shop@example.com");
    await sendMail("buyer@example.com", email, [pdf]);
    const got = sink.received.at(-1)!;
    expect(got.to).toEqual(["RCPT TO:<buyer@example.com>"]);
    expect(got.from).toContain("<shop@example.com>");
    expect(got.auth).toBe("shop@example.com:abcd efgh ijkl mnop"); // spaces are only dropped for Gmail
    expect(got.data).toContain("Subject: Your receipt BITC/2627/000001");
    expect(got.data).toMatch(/Content-Type: application\/pdf; name=Invoice-BITC-2627-000001\.pdf/);
    expect(got.data).toMatch(/Content-Disposition: attachment; filename=Invoice-BITC-2627-000001\.pdf/);
    expect(got.data).toContain(pdf.content.toString("base64"));
    expect(outboxMail()[0]).toMatchObject({ to: "buyer@example.com", error: null });
    expect(outboxMail()[0].sentAt).toBeInstanceOf(Date);
  });

  it("throws when the server turns down the login, and keeps the reason", async () => {
    useSmtp("wrong");
    const before = sink.received.length;
    await expect(sendMail("buyer@example.com", email)).rejects.toThrow(/535/);
    expect(sink.received.length).toBe(before);
    expect(outboxMail()[0].sentAt).toBeNull();
    expect(outboxMail()[0].error).toMatch(/Username and Password not accepted/);

    // Fixed in .env: sending it again from the outbox delivers it.
    useSmtp("right");
    await sendFromOutbox(outboxMail()[0].id);
    expect(sink.received.length).toBe(before + 1);
    expect(outboxMail()[0]).toMatchObject({ error: null });
  });

  it("only keeps the message when no provider is set up", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_USER", "");
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(mailStatus()).toBeNull();
    const before = sink.received.length;
    await sendMail("buyer@example.com", email);
    expect(sink.received.length).toBe(before);
    expect(outboxMail()[0]).toMatchObject({ to: "buyer@example.com", sentAt: null, error: null });
  });
});
