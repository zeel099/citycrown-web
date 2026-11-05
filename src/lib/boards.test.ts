import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const period = { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() };
vi.mock("./db", () => ({ db: { period } }));

const { currentPeriod } = await import("./boards");

const board = { id: "board1", type: "DAILY" as const };
const existing = { id: "p1", boardId: "board1", status: "OPEN" };

describe("currentPeriod", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses the period another request just opened when they race at the reset", () => {
    period.upsert.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" }));
    period.findUniqueOrThrow.mockResolvedValue(existing);
    period.updateMany.mockResolvedValue({ count: 0 });
    return expect(currentPeriod(board, "Asia/Kolkata")).resolves.toBe(existing);
  });

  it("still fails on any other database error", async () => {
    period.upsert.mockRejectedValue(new Error("connection lost"));
    await expect(currentPeriod(board, "Asia/Kolkata")).rejects.toThrow("connection lost");
    expect(period.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
