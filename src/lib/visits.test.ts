import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));
const { visitDay } = await import("./visits");

describe("visitDay", () => {
  it("is the date in India, which starts 5½ hours before UTC's", () => {
    expect(visitDay(new Date("2026-11-03T18:29:59Z"))).toBe("2026-11-03");
    expect(visitDay(new Date("2026-11-03T18:30:00Z"))).toBe("2026-11-04");
  });
});
