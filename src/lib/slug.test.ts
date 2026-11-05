import { describe, expect, it } from "vitest";
import { normalizeName, slugify } from "./slug";

describe("normalizeName", () => {
  it("treats apostrophes, case and punctuation as the same name (FR-LST-02)", () => {
    expect(normalizeName("Zeel's Chai")).toBe(normalizeName("zeels chai"));
    expect(normalizeName("Chai & Chapter")).toBe("chai chapter");
  });

  it("builds URL slugs", () => {
    expect(slugify("T-shirts")).toBe("t-shirts");
  });
});
