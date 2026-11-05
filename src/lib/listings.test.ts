import { describe, expect, it } from "vitest";
import { linkCandidates, shortLink } from "./business-link";
import { canonicalLink, parseBusinessLink } from "./listings";

describe("parseBusinessLink (claim bar)", () => {
  it("reads Instagram handles with or without @", () => {
    expect(parseBusinessLink("@MonsoonBeans")).toBe("https://instagram.com/monsoonbeans");
    expect(parseBusinessLink("monsoon_beans")).toBe("https://instagram.com/monsoon_beans");
    expect(parseBusinessLink("@monsoon.beans")).toBe("https://instagram.com/monsoon.beans");
  });

  it("reads profile and website links in any common form", () => {
    expect(parseBusinessLink("https://www.instagram.com/monsoonbeans/?hl=en")).toBe("https://instagram.com/monsoonbeans");
    expect(parseBusinessLink("instagram.com/monsoonbeans/reels")).toBe("https://instagram.com/monsoonbeans");
    expect(parseBusinessLink("m.facebook.com/MonsoonBeans")).toBe("https://facebook.com/monsoonbeans");
    expect(parseBusinessLink("monsoonbeans.in")).toBe("https://monsoonbeans.in");
    expect(parseBusinessLink("http://www.example.com/brew-lane/")).toBe("https://example.com/brew-lane");
  });

  it("rejects things that aren't a handle or a link", () => {
    expect(parseBusinessLink("")).toBeNull();
    expect(parseBusinessLink("my shop")).toBeNull();
    expect(parseBusinessLink("@has spaces")).toBeNull();
  });

  it("matches stored links to pasted ones", () => {
    expect(canonicalLink("https://instagram.com/monsoonbeans")).toBe(parseBusinessLink("@monsoonbeans"));
    expect(canonicalLink("https://example.com/brew-lane")).toBe(parseBusinessLink("example.com/brew-lane"));
  });
});

describe("linkCandidates (handle or website?)", () => {
  it("checks a dotted name as an Instagram handle first", () => {
    expect(linkCandidates("raj.sojitra17")).toEqual(["https://instagram.com/raj.sojitra17", "https://raj.sojitra17"]);
    expect(linkCandidates("av.madhuram.sandwich")[0]).toBe("https://instagram.com/av.madhuram.sandwich");
  });

  it("checks a common web address as a website first", () => {
    expect(linkCandidates("bluetokaicoffee.com")).toEqual(["https://bluetokaicoffee.com", "https://instagram.com/bluetokaicoffee.com"]);
    expect(linkCandidates("monsoon.co.in")[0]).toBe("https://monsoon.co.in");
  });

  it("has one reading when the text is clear", () => {
    expect(linkCandidates("@raj.sojitra17")).toEqual(["https://instagram.com/raj.sojitra17"]);
    expect(linkCandidates("zeel_099")).toEqual(["https://instagram.com/zeel_099"]);
    expect(linkCandidates("https://shop.in/menu")).toEqual(["https://shop.in/menu"]);
    expect(linkCandidates("facebook.com/starbucks")).toEqual(["https://facebook.com/starbucks"]);
    expect(linkCandidates("my shop")).toEqual([]);
  });
});

describe("shortLink (Daily page)", () => {
  it("shows Instagram as a handle, Facebook as its page and a website as its domain", () => {
    expect(shortLink("https://www.instagram.com/MonsoonBeans/?hl=en")).toBe("@monsoonbeans");
    expect(shortLink("https://m.facebook.com/BrewLane")).toBe("facebook.com/brewlane");
    expect(shortLink("https://www.brewlane.in/menu/today")).toBe("brewlane.in");
  });
});
