import { describe, expect, it } from "vitest";
import { periodBounds, startOfLocalDay, startOfLocalWeek } from "./time";

describe("period bounds", () => {
  it("starts a daily board at 00:00 IST", () => {
    // 2026-10-30 20:00 UTC is 2026-10-31 01:30 IST.
    expect(startOfLocalDay(new Date("2026-10-30T20:00:00Z"), "Asia/Kolkata").toISOString()).toBe(
      "2026-10-30T18:30:00.000Z",
    );
  });

  it("ends a daily period 24 hours later", () => {
    const { startsAt, endsAt } = periodBounds("DAILY", new Date("2026-10-30T10:00:00Z"), "Asia/Kolkata");
    expect(endsAt!.getTime() - startsAt.getTime()).toBe(864e5);
  });

  it("starts a weekly board on Monday 00:00 local", () => {
    // Friday 2026-10-30 → Monday 2026-10-26 00:00 IST.
    expect(startOfLocalWeek(new Date("2026-10-30T10:00:00Z"), "Asia/Kolkata").toISOString()).toBe(
      "2026-10-25T18:30:00.000Z",
    );
  });

  it("handles a DST zone", () => {
    // New York, day after DST ends (2026-11-01): midnight is 05:00 UTC.
    expect(startOfLocalDay(new Date("2026-11-02T12:00:00Z"), "America/New_York").toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });

  it("gives all-time boards one open-ended period", () => {
    expect(periodBounds("ALL_TIME", new Date(), "Asia/Kolkata")).toEqual({ startsAt: new Date(0), endsAt: null });
  });
});
