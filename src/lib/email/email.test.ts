import { describe, expect, it } from "vitest";
import { emailPreviews, outbidAlertEmail, receiptEmail, takeBackPrice } from "./index";

describe("email templates", () => {
  it("renders every preview with html and text", () => {
    for (const [name, render] of Object.entries(emailPreviews)) {
      const email = render();
      expect(email.subject, name).not.toBe("");
      expect(email.html, name).toContain("<!doctype html>");
      expect(email.text, name).not.toContain("<");
    }
  });

  it("escapes business names", () => {
    const email = receiptEmail({
      invoiceNo: "BITC/2627/000001",
      dateLabel: "2 Nov 2026, 12:21 am",
      billedTo: "you@example.com",
      listingName: `<script>alert("x")</script>`,
      boardLabel: "Surat → Cafes",
      rank: 2,
      amount: 92000,
      taxable: 77966,
      tax: 14034,
      amountInWords: "Rupees Nine Hundred Twenty Only",
      currency: "INR",
      receiptUrl: "https://example.com/receipts/1",
      pdfName: "Invoice-BITC-2627-000001.pdf",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain("It's now #2.");
  });

  it("prices taking #1 back as total above − yours + step", () => {
    expect(takeBackPrice({ leaderTotal: 520000, ownTotal: 500000, step: 1000, minBid: 10000 })).toBe(21000);
    const email = outbidAlertEmail({
      listingName: "Brew Lane",
      boardLabel: "Surat · Cafes",
      leaderName: "The Kettle Room",
      leaderTotal: 520000,
      ownTotal: 500000,
      step: 1000,
      minBid: 10000,
      currency: "INR",
      boardUrl: "https://example.com/surat/cafes",
    });
    expect(email.subject).toBe("Brew Lane just lost #1 on Surat · Cafes");
    expect(email.text).toContain("Take #1 back for ₹210");
    expect(email.text).toContain("₹5,200 − ₹5,000 + ₹10 step");
  });

  it("never asks for less than the minimum bid", () => {
    expect(takeBackPrice({ leaderTotal: 501000, ownTotal: 500000, step: 1000, minBid: 10000 })).toBe(10000);
    const email = outbidAlertEmail({
      listingName: "Brew Lane",
      boardLabel: "Surat · Cafes",
      leaderName: "The Kettle Room",
      leaderTotal: 501000,
      ownTotal: 500000,
      step: 1000,
      minBid: 10000,
      currency: "INR",
      boardUrl: "https://example.com/surat/cafes",
    });
    expect(email.text).toContain("Take #1 back for ₹100 (the minimum bid of ₹100)");
  });
});
