import { describe, expect, it } from "vitest";
import { checkLink, hostLabel, isPrivateAddress, unsafeReason } from "./link-check";

describe("isPrivateAddress", () => {
  it("refuses loopback, private, link-local and reserved addresses", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "ff02::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "157.240.1.174", "2606:4700:4700::1111", "2a03:2880:f12f:83:face:b00c:0:25de"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("treats anything that isn't an IP as unsafe", () => {
    expect(isPrivateAddress("example.com")).toBe(true);
  });
});

describe("unsafeReason", () => {
  const reason = (url: string) => unsafeReason(new URL(url));

  it("accepts public https links", () => {
    expect(reason("https://instagram.com/sipandstories")).toBeNull();
    expect(reason("https://www.example.com:443/menu")).toBeNull();
    expect(reason("https://8.8.8.8/")).toBeNull();
  });

  it("only follows https", () => {
    expect(reason("http://example.com")).toBe("not an https link");
    expect(reason("ftp://example.com")).toBe("not an https link");
  });

  it("refuses credentials and non-standard ports", () => {
    expect(reason("https://user:pass@example.com")).toBe("link has a username or password");
    expect(reason("https://example.com:8443")).toBe("non-standard port");
  });

  it("refuses local names and private IP literals, however they are written", () => {
    for (const url of [
      "https://localhost/",
      "https://shop.localhost/",
      "https://printer.local/",
      "https://intranet/",
      "https://127.0.0.1/",
      "https://2130706433/",
      "https://0x7f.1/",
      "https://[::1]/",
      "https://[::ffff:127.0.0.1]/",
      "https://169.254.169.254/latest/meta-data",
    ]) {
      expect(reason(url), url).toBe("private address");
    }
  });
});

describe("hostLabel", () => {
  it("drops www for the moderation note", () => {
    expect(hostLabel(new URL("https://www.instagram.com/shop"))).toBe("instagram.com");
  });
});

describe("checkLink", () => {
  it("never connects when the name resolves to a private address", async () => {
    const result = await checkLink("https://shop.example.com/", { resolve: async () => ["93.184.216.34", "10.0.0.5"] });
    expect(result).toEqual({ ok: false, note: "shop.example.com: private address" });
  });

  it("reports a failed lookup as unreachable", async () => {
    const result = await checkLink("https://instagram.com/sipandstories", {
      resolve: async () => {
        throw new Error("ENOTFOUND");
      },
    });
    expect(result).toEqual({ ok: false, note: "instagram.com: unreachable" });
  });

  it("reports a slow lookup as timed out", async () => {
    const result = await checkLink("https://slow.example.com/", { resolve: () => new Promise(() => {}), timeoutMs: 20 });
    expect(result).toEqual({ ok: false, note: "slow.example.com: timed out" });
  });

  it("refuses unsafe links without fetching them", async () => {
    expect(await checkLink("http://example.com/")).toEqual({ ok: false, note: "example.com: not an https link" });
    expect(await checkLink("not a url")).toEqual({ ok: false, note: "invalid link" });
  });
});
