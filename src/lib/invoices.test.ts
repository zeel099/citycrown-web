import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { amountInWords, financialYear, formatInvoiceNo, gstSplit, nextInvoiceNo, numberInWords } from "./invoices";

describe("financial year", () => {
  it("labels April to March", () => {
    expect(financialYear(new Date("2026-11-02T06:00:00Z"))).toBe("2627");
    expect(financialYear(new Date("2027-01-15T06:00:00Z"))).toBe("2627");
    expect(financialYear(new Date("2026-03-15T06:00:00Z"))).toBe("2526");
  });

  it("switches at midnight IST on 1 April, not UTC", () => {
    // 31 March 2027 23:59 IST
    expect(financialYear(new Date("2027-03-31T18:29:00Z"))).toBe("2627");
    // 1 April 2027 00:30 IST is still 31 March in UTC
    expect(financialYear(new Date("2027-03-31T19:00:00Z"))).toBe("2728");
  });

  it("handles the century turn", () => {
    expect(financialYear(new Date("2099-06-01T00:00:00Z"))).toBe("9900");
  });
});

describe("invoice numbers", () => {
  it("pads the sequence to six digits", () => {
    expect(formatInvoiceNo("2627", 5)).toBe("BITC/2627/000005");
    expect(formatInvoiceNo("2627", 123456)).toBe("BITC/2627/123456");
  });

  it("takes the next number from the counter for the payment's financial year", async () => {
    const upsert = vi.fn().mockResolvedValue({ fy: "2627", last: 14 });
    const tx = { invoiceCounter: { upsert } } as unknown as Prisma.TransactionClient;
    await expect(nextInvoiceNo(tx, new Date("2026-11-02T06:00:00Z"))).resolves.toBe("BITC/2627/000014");
    expect(upsert).toHaveBeenCalledWith({
      where: { fy: "2627" },
      create: { fy: "2627", last: 1 },
      update: { last: { increment: 1 } },
    });
  });
});

describe("GST split", () => {
  it("takes 18% GST out of the amount paid", () => {
    expect(gstSplit(141000)).toEqual({ taxable: 119492, tax: 21508 }); // ₹1,410 → ₹1,194.92 + ₹215.08
    expect(gstSplit(92000)).toEqual({ taxable: 77966, tax: 14034 }); // ₹920 → ₹779.66 + ₹140.34
  });

  it("always adds back up to the amount paid", () => {
    for (const amount of [1, 99, 1000, 51000, 123457]) {
      const { taxable, tax } = gstSplit(amount);
      expect(taxable + tax).toBe(amount);
    }
  });
});

describe("amount in words (Indian numbering)", () => {
  it("writes whole numbers with lakh and crore", () => {
    expect(numberInWords(0)).toBe("Zero");
    expect(numberInWords(1410)).toBe("One Thousand Four Hundred Ten");
    expect(numberInWords(141000)).toBe("One Lakh Forty One Thousand");
    expect(numberInWords(21500000)).toBe("Two Crore Fifteen Lakh");
    expect(numberInWords(99)).toBe("Ninety Nine");
  });

  it("writes the invoice total with paise", () => {
    expect(amountInWords(141000, "INR")).toBe("Rupees One Thousand Four Hundred Ten Only");
    expect(amountInWords(119492, "INR")).toBe("Rupees One Thousand One Hundred Ninety Four and Paise Ninety Two Only");
    expect(amountInWords(10000, "INR")).toBe("Rupees One Hundred Only");
  });
});
