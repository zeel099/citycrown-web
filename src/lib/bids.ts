import crypto from "node:crypto";
import type { BoardType, Gateway } from "@prisma/client";
import { after } from "next/server";
import { refreshProfile } from "./avatars";
import { db } from "./db";
import { currentPeriod, loadRankedBoard } from "./boards";
import { outbidAlertEmail, receiptEmail, siteUrl } from "./email";
import { invoiceForBid } from "./invoice-data";
import { invoicePdf } from "./invoice-pdf";
import { gstSplit, nextInvoiceNo } from "./invoices";
import { listingForClaim, recordLinkCheck, sameBusiness } from "./listings";
import { normalizeEmail, sendMail } from "./mailer";
import { formatMoney } from "./money";
import { providerFor } from "./payments";
import type { Checkout } from "./payments";
import { rankListings } from "./ranking";

export class BidError extends Error {}

type NewBid = {
  /** A business on the board, or one pasted into the claim bar by its link. */
  target: { listingId: string } | { boardId: string; name: string; link: string; location?: { lat: number; lng: number; address?: string } | null };
  amount: number; // minor units
  email: string;
  displayName?: string | null;
  acceptedTerms: boolean;
};

/**
 * Creates a PENDING bid and a gateway order. Nothing changes rank until a
 * verified webhook confirms the payment (FR-PAY-03, BR-06). A business pasted
 * into the claim bar is created as AWAITING_PAYMENT and goes live once paid.
 */
export async function createBid(input: NewBid): Promise<{ bidId: string; checkout: Checkout }> {
  if (!input.acceptedTerms) throw new BidError("Accept the non-refundable terms to continue."); // FR-BID-05
  const email = normalizeEmail(input.email);
  let listingId: string;
  if ("listingId" in input.target) {
    listingId = input.target.listingId;
  } else {
    // Check the amount before a new business is created, so a refused bid leaves nothing behind.
    const board = await db.board.findUnique({ where: { id: input.target.boardId }, include: { city: true } });
    if (board && (!Number.isInteger(input.amount) || input.amount < board.minBid)) {
      throw new BidError(`The minimum bid is ${formatMoney(board.minBid, board.city.currency)}.`);
    }
    const claim = await listingForClaim({ ...input.target, email });
    listingId = claim.listing.id;
    // FR-ADM-03: a link we couldn't confirm online is checked again in the background for staff.
    if (claim.recheck.length) after(() => recordLinkCheck(claim.recheck, claim.url));
  }
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { board: { include: { city: true, category: true } } },
  });
  const pasted = !("listingId" in input.target) && (listing?.status === "AWAITING_PAYMENT" || listing?.status === "PENDING");
  if (!listing || (listing.status !== "LIVE" && !pasted)) throw new BidError("This business is not open for bids.");
  const { board } = listing;
  // Fetch the business picture while the bidder pays, so the board can show it once the bid lands.
  if (!listing.isSeed) after(() => refreshProfile(listing.id));
  if (!Number.isInteger(input.amount) || input.amount < board.minBid) {
    throw new BidError(`The minimum bid is ${formatMoney(board.minBid, board.city.currency)}.`);
  }

  const period = await currentPeriod(board, board.city.timeZone);
  const user = await db.user.upsert({ where: { email }, create: { email }, update: {} });
  const bid = await db.bid.create({
    data: {
      listingId: listing.id,
      periodId: period.id,
      userId: user.id,
      guestEmail: email,
      amount: input.amount,
      currency: board.city.currency,
      displayName: input.displayName?.trim() || null,
    },
  });

  const provider = providerFor(board.city.currency);
  try {
    const { gatewayRef, checkout } = await provider.createCheckout({
      bidId: bid.id,
      amount: bid.amount,
      currency: bid.currency,
      email,
      description: `Bid on ${listing.name} · ${board.city.name} → ${board.category.name}`,
      returnPath: `/${board.city.slug}/${board.category.slug}${PERIOD_QUERY[board.type]}`,
    });
    await db.payment.create({ data: { bidId: bid.id, gateway: provider.gateway, gatewayRef } });
    return { bidId: bid.id, checkout };
  } catch (err) {
    await db.bid.update({ where: { id: bid.id }, data: { status: "FAILED" } });
    throw err;
  }
}

type ConfirmResult = "confirmed" | "already-confirmed" | "amount-mismatch" | "unknown";

/**
 * Called from verified webhooks only. Idempotent: a repeated webhook finds the
 * bid already confirmed and changes nothing (NFR-03). A confirmed bid gets the
 * next invoice number in the same transaction (FR-PAY-04); the receipt and
 * outbid emails go out after it commits and never fail the webhook.
 */
export async function confirmPayment(args: {
  gateway: Gateway;
  gatewayRef: string;
  gatewayPaymentId?: string | null;
  amount: number;
}): Promise<ConfirmResult> {
  const { result, bidId } = await db.$transaction(async (tx): Promise<{ result: ConfirmResult; bidId?: string }> => {
    const payment = await tx.payment.findUnique({
      where: { gateway_gatewayRef: { gateway: args.gateway, gatewayRef: args.gatewayRef } },
      include: { bid: { include: { listing: { include: { board: true } } } } },
    });
    if (!payment) return { result: "unknown" };
    if (payment.bid.status === "CONFIRMED") return { result: "already-confirmed" };
    if (payment.bid.amount !== args.amount) {
      await tx.bid.update({ where: { id: payment.bidId }, data: { status: "FAILED" } });
      await tx.auditLog.create({
        data: { actor: "system", action: "bid.amount_mismatch", target: payment.bidId, after: { paid: args.amount, expected: payment.bid.amount } },
      });
      return { result: "amount-mismatch" };
    }
    const now = new Date();
    // Only a PENDING (or previously FAILED, then paid) bid moves to CONFIRMED; the
    // conditional update makes two concurrent webhooks count the bid once.
    const { count } = await tx.bid.updateMany({
      where: { id: payment.bidId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "CONFIRMED", confirmedAt: now },
    });
    if (count === 0) return { result: "already-confirmed" };
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        gatewayPaymentId: args.gatewayPaymentId ?? payment.gatewayPaymentId,
        webhookVerifiedAt: now,
        invoiceNo: payment.invoiceNo ?? (await nextInvoiceNo(tx, now)),
        receiptKey: payment.receiptKey ?? crypto.randomBytes(24).toString("base64url"),
        tax: payment.bid.currency === "INR" ? gstSplit(payment.bid.amount).tax : null,
      },
    });
    // A business pasted into the claim bar goes live on all its boards with its first paid bid.
    const { listing } = payment.bid;
    if (listing.status === "AWAITING_PAYMENT" || listing.status === "PENDING") {
      const { count: madeLive } = await tx.listing.updateMany({
        where: { ...sameBusiness(listing), status: { in: ["AWAITING_PAYMENT", "PENDING"] } },
        data: { status: "LIVE" },
      });
      await tx.auditLog.create({
        data: { actor: "system", action: "listing.live_after_payment", target: listing.id, before: { status: listing.status }, after: { status: "LIVE", listings: madeLive, bidId: payment.bidId } },
      });
    }
    return { result: "confirmed", bidId: payment.bidId };
  });
  if (result === "confirmed" && bidId) {
    // Send after the webhook has answered, so slow email never delays or fails it.
    try {
      after(() => notifyConfirmed(bidId));
    } catch {
      await notifyConfirmed(bidId); // outside a request (scripts, tests)
    }
  }
  return result;
}

const PERIOD_LABEL: Record<BoardType, string> = { ALL_TIME: "", DAILY: " · Today", WEEKLY: " · This week" };
const PERIOD_QUERY: Record<BoardType, string> = { ALL_TIME: "", DAILY: "?period=today", WEEKLY: "?period=week" };

/** Receipt to the bidder, then an outbid alert if this bid took #1 from a verified owner's business. */
async function notifyConfirmed(bidId: string): Promise<void> {
  try {
    const bid = await db.bid.findUniqueOrThrow({
      where: { id: bidId },
      include: { payment: true, user: true, period: true, listing: { include: { board: { include: { city: true, category: true } } } } },
    });
    const { board } = bid.listing;
    const boardLabel = `${board.city.name} · ${board.category.name}${PERIOD_LABEL[board.type]}`;
    const boardUrl = siteUrl(`/${board.city.slug}/${board.category.slug}${PERIOD_QUERY[board.type]}`);

    const [listings, totalsAfter, totalsBefore] = await Promise.all([
      db.listing.findMany({ where: { boardId: board.id, status: "LIVE" }, include: { owner: true } }),
      db.bid.groupBy({ by: ["listingId"], where: { periodId: bid.periodId, status: "CONFIRMED" }, _sum: { amount: true }, _max: { confirmedAt: true } }),
      db.bid.groupBy({ by: ["listingId"], where: { periodId: bid.periodId, status: "CONFIRMED", id: { not: bid.id } }, _sum: { amount: true }, _max: { confirmedAt: true } }),
    ]);
    const rank = (totals: typeof totalsAfter) => {
      const by = new Map(totals.map((t) => [t.listingId, t]));
      return rankListings(listings.map((l) => ({ ...l, total: by.get(l.id)?._sum.amount ?? 0, reachedAt: by.get(l.id)?._max.confirmedAt ?? null })));
    };
    const rankedAfter = rank(totalsAfter);
    const rankedBefore = rank(totalsBefore);
    const open = bid.period.status === "OPEN";

    // The business's picture for the board, saved with its first paid bid.
    await refreshProfile(bid.listingId);

    // FR-PAY-04: the receipt, with the GST tax invoice attached as a PDF.
    const invoice = await invoiceForBid(bid.id);
    if (invoice?.billedTo) {
      await sendMail(
        invoice.billedTo,
        receiptEmail({
          invoiceNo: invoice.invoiceNo,
          dateLabel: invoice.dateLabel,
          billedTo: invoice.billedTo,
          listingName: invoice.listingName,
          boardLabel: invoice.boardLabel,
          rank: open ? (rankedAfter.find((l) => l.id === bid.listingId)?.rank ?? null) : null,
          amount: invoice.amount,
          taxable: invoice.gst ? invoice.taxable : null,
          tax: invoice.gst ? invoice.tax : null,
          amountInWords: invoice.amountInWords,
          currency: invoice.currency,
          receiptUrl: invoice.receiptUrl,
          pdfName: invoice.fileName,
        }),
        [{ filename: invoice.fileName, content: invoicePdf(invoice), contentType: "application/pdf" }],
      ).catch((err) => console.error(`[bids] receipt email for ${bid.id} failed`, err));
    }

    // FR-ACC-02: tell the verified owner of the business that just lost #1.
    const lost = rankedBefore[0];
    const leader = rankedAfter[0];
    if (!open || lost?.rank !== 1 || leader?.id === lost.id || lost.id === bid.listingId || !lost.owner?.email) return;
    const ownTotal = rankedAfter.find((l) => l.id === lost.id)?.total ?? lost.total;
    const hourAgo = new Date(Date.now() - 3600e3);
    const { count } = await db.listing.updateMany({
      where: { id: lost.id, OR: [{ lastOutbidAlertAt: null }, { lastOutbidAlertAt: { lt: hourAgo } }] },
      data: { lastOutbidAlertAt: new Date() },
    });
    if (count === 0) return;
    await sendMail(
      lost.owner.email,
      outbidAlertEmail({
        listingName: lost.name,
        boardLabel,
        leaderName: leader.name,
        leaderTotal: leader.total,
        ownTotal,
        step: board.step,
        minBid: board.minBid,
        currency: bid.currency,
        boardUrl,
      }),
    ).catch((err) => console.error(`[bids] outbid alert for ${lost.id} failed`, err));
  } catch (err) {
    console.error(`[bids] notifications for ${bidId} failed`, err);
  }
}

export async function failPayment(gateway: Gateway, gatewayRef: string) {
  const payment = await db.payment.findUnique({ where: { gateway_gatewayRef: { gateway, gatewayRef } } });
  if (!payment) return;
  await db.bid.updateMany({ where: { id: payment.bidId, status: "PENDING" }, data: { status: "FAILED" } });
}

/** FR-PAY-05: a refund or chargeback removes the bid from the total; the board re-ranks on next read. */
export async function reversePayment(gateway: Gateway, gatewayPaymentId: string, reason: string) {
  const payment = await db.payment.findFirst({ where: { gateway, gatewayPaymentId }, include: { bid: true } });
  if (!payment || payment.bid.status !== "CONFIRMED") return;
  await db.$transaction([
    db.bid.update({ where: { id: payment.bidId }, data: { status: "REVERSED" } }),
    db.auditLog.create({
      data: { actor: `gateway:${gateway.toLowerCase()}`, action: "bid.reversed", target: payment.bidId, after: { reason } },
    }),
  ]);
}

/** Status the browser polls after paying, with the listing's new rank once confirmed. */
export async function bidStatus(bidId: string) {
  const bid = await db.bid.findUnique({
    where: { id: bidId },
    include: { listing: { include: { board: { include: { city: true } } } } },
  });
  if (!bid) return null;
  let rank: number | null = null;
  if (bid.status === "CONFIRMED") {
    const { ranked } = await loadRankedBoard(bid.listing.board);
    rank = ranked.find((l) => l.id === bid.listingId)?.rank ?? null;
  }
  return { status: bid.status, amount: bid.amount, currency: bid.currency, listingName: bid.listing.name, rank };
}
