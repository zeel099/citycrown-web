import { describe, expect, it } from "vitest";
import {
  availableMethods,
  CODE_ALPHABET,
  generateVerificationCode,
  headHasCode,
  isBlockedAddress,
  methodFromSlug,
  safeHttpsUrl,
  textHasCode,
} from "./verification";

const CODE = "BITC-4V8DFH34";

describe("verification codes", () => {
  it("are BITC- plus 8 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode();
      expect(code).toMatch(new RegExp(`^BITC-[${CODE_ALPHABET}]{8}$`));
      expect(code.slice(5)).not.toMatch(/[01IO]/);
    }
  });
});

describe("meta tag matching", () => {
  it("finds the tag in <head>", () => {
    expect(headHasCode(`<html><head><title>x</title><meta name="bitc-verification" content="${CODE}"></head><body></body></html>`, CODE)).toBe(true);
  });

  it("accepts any attribute order, quoting and case", () => {
    expect(headHasCode(`<head><META content='${CODE.toLowerCase()}' NAME='BITC-Verification' /></head>`, CODE)).toBe(true);
    expect(headHasCode(`<head><meta name=bitc-verification content=${CODE}></head>`, CODE)).toBe(true);
  });

  it("ignores tags in <body>, other names and other codes", () => {
    expect(headHasCode(`<head></head><body><meta name="bitc-verification" content="${CODE}"></body>`, CODE)).toBe(false);
    expect(headHasCode(`<head><meta name="description" content="${CODE}"></head>`, CODE)).toBe(false);
    expect(headHasCode(`<head><meta name="bitc-verification" content="BITC-AAAAAAAA"></head>`, CODE)).toBe(false);
  });
});

describe("code in text", () => {
  it("finds the code as a whole token in a bio or text file", () => {
    expect(textHasCode(`Coffee & books ☕ ${CODE} · open 8–10`, CODE)).toBe(true);
    expect(textHasCode(`${CODE}\n`, CODE)).toBe(true);
    expect(textHasCode(`"biography":"Brewing since 2019 ${CODE.toLowerCase()}"`, CODE)).toBe(true);
  });

  it("rejects partial matches", () => {
    expect(textHasCode(`${CODE}5`, CODE)).toBe(false);
    expect(textHasCode(`XBITC-4V8DFH34`, CODE)).toBe(false);
    expect(textHasCode(`BITC-4V8DFH3`, CODE)).toBe(false);
  });
});

describe("safe fetching", () => {
  it("blocks private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });

  it("allows public addresses", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("only fetches https on the default port, with no credentials or private IP literals", () => {
    expect(safeHttpsUrl("http://example.com/brew-lane")?.toString()).toBe("https://example.com/brew-lane");
    expect(safeHttpsUrl("https://example.com:443/")?.toString()).toBe("https://example.com/");
    expect(safeHttpsUrl("https://example.com:8443/")).toBeNull();
    expect(safeHttpsUrl("https://user:pass@example.com/")).toBeNull();
    expect(safeHttpsUrl("https://127.0.0.1/")).toBeNull();
    expect(safeHttpsUrl("https://[::1]/")).toBeNull();
    expect(safeHttpsUrl("https://2130706433/")).toBeNull();
    expect(safeHttpsUrl("ftp://example.com/")).toBeNull();
    expect(safeHttpsUrl("not a url")).toBeNull();
  });
});

describe("methods", () => {
  it("offers a method for each link the listing has", () => {
    expect(availableMethods({ websiteUrl: "https://a.in", instagramUrl: null, facebookUrl: "https://facebook.com/a" })).toEqual(["WEBSITE", "FACEBOOK"]);
    expect(availableMethods({ websiteUrl: null, instagramUrl: null, facebookUrl: null })).toEqual([]);
  });

  it("maps URL slugs to methods", () => {
    expect(methodFromSlug("instagram")).toBe("INSTAGRAM");
    expect(methodFromSlug("INSTAGRAM")).toBeNull();
    expect(methodFromSlug(undefined)).toBeNull();
  });
});
