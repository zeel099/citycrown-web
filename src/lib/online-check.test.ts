import { describe, expect, it } from "vitest";
import { decodeEntities, parseFollowers, readFacebook, readInstagram, readWebsite, siteIcon } from "./online-check";
import type { FetchResult } from "./verification";

const page = (body: string, status = 200, url = "https://www.instagram.com/x/"): FetchResult => ({ ok: true, status, body, url });

describe("readInstagram", () => {
  const real = `<html><head><title>Blue Tokai Coffee Roasters (&#064;bluetokaicoffee) • Instagram photos and videos</title>
    <meta property="og:title" content="Blue Tokai Coffee Roasters (&#064;bluetokaicoffee) &#x2022; Instagram photos and videos" />
    <meta property="og:image" content="https://scontent.cdninstagram.com/v/pic.jpg?stp=s100x100&amp;oh=1" />
    <meta property="og:description" content="152K Followers, 64 Following, 2,876 Posts - See Instagram photos and videos from Blue Tokai Coffee Roasters (&#064;bluetokaicoffee)" /></head></html>`;

  it("finds a real account and reads its name and profile picture", () => {
    expect(readInstagram("bluetokaicoffee", page(real))).toEqual({
      status: "found",
      platform: "Instagram",
      name: "Blue Tokai Coffee Roasters",
      image: "https://scontent.cdninstagram.com/v/pic.jpg?stp=s100x100&oh=1",
      followers: 152000,
    });
    expect(readInstagram("BlueTokaiCoffee", page(real)).status).toBe("found");
  });

  it("reports a missing account (Instagram answers 200 with a bare page)", () => {
    const r = readInstagram("zz_no_such_cafe", page("<html><head><title>Instagram</title></head></html>"));
    expect(r.status).toBe("missing");
  });

  it("doesn't call a login wall, rate limit or outage missing", () => {
    expect(readInstagram("x", page("<title>Login • Instagram</title>")).status).toBe("unknown");
    expect(readInstagram("x", page("", 200, "https://www.instagram.com/accounts/login/?next=/x/")).status).toBe("unknown");
    expect(readInstagram("x", page("", 429)).status).toBe("unknown");
    expect(readInstagram("x", { ok: false, reason: "it took too long to answer" }).status).toBe("unknown");
  });

  it("won't accept a page for a different handle", () => {
    expect(readInstagram("someoneelse", page(real)).status).toBe("unknown");
  });
});

describe("readFacebook", () => {
  it("finds a real page by its og:title", () => {
    const r = readFacebook(page(`<meta property="og:title" content="Starbucks" /><title>Starbucks</title>`, 200, "https://www.facebook.com/Starbucks/"), "facebook.com/starbucks");
    expect(r).toEqual({ status: "found", platform: "Facebook", name: "Starbucks", image: null, followers: null });
  });

  it("reports a missing page and treats a login wall as unknown", () => {
    expect(readFacebook(page("<title>Facebook</title>", 200, "https://www.facebook.com/zz"), "facebook.com/zz").status).toBe("missing");
    expect(readFacebook(page("", 200, "https://www.facebook.com/login/?next=x"), "facebook.com/zz").status).toBe("unknown");
  });
});

describe("readWebsite", () => {
  it("finds a site and shortens its title to a name", () => {
    const r = readWebsite(page(`<title>Blue Tokai Coffee Roasters | Buy Coffee Online</title>`, 200, "https://bluetokaicoffee.com/"), "bluetokaicoffee.com");
    expect(r).toEqual({ status: "found", platform: "Website", name: "Blue Tokai Coffee Roasters", image: null, followers: null });
  });

  it("counts a site that blocks robots as online", () => {
    expect(readWebsite(page("", 403, "https://shop.in/"), "shop.in")).toEqual({ status: "found", platform: "Website", name: null, image: null, followers: null });
  });

  it("reports addresses and pages that don't exist", () => {
    expect(readWebsite({ ok: false, reason: "the address doesn't exist", notFound: true }, "zz.in").status).toBe("missing");
    expect(readWebsite(page("", 404), "shop.in/menu").status).toBe("missing");
  });

  it("is unsure when the site is down", () => {
    expect(readWebsite(page("", 503), "shop.in").status).toBe("unknown");
    expect(readWebsite({ ok: false, reason: "it took too long to answer" }, "shop.in").status).toBe("unknown");
  });
});

it("decodes HTML entities in names", () => {
  expect(decodeEntities("Chai &amp; Chapter (&#064;chai) &#x2022; x")).toBe("Chai & Chapter (@chai) • x");
});

describe("siteIcon", () => {
  it("prefers the apple-touch-icon, then the largest icon, resolved against the page", () => {
    const html = `<link rel="icon" href="/favicon-32.png" sizes="32x32"><link rel="icon" sizes="192x192" href="/icon-192.png">
      <link rel="apple-touch-icon" href="/apple.png">`;
    expect(siteIcon(html, "https://shop.in/menu")).toBe("https://shop.in/apple.png");
    expect(siteIcon(html.replace(/<link rel="apple-touch-icon"[^>]*>/, ""), "https://shop.in/")).toBe("https://shop.in/icon-192.png");
  });

  it("skips SVG icons and plain-http ones", () => {
    expect(siteIcon(`<link rel="icon" href="/logo.svg">`, "https://shop.in/")).toBeNull();
    expect(siteIcon(`<link rel="icon" href="http://cdn.shop.in/i.png">`, "https://shop.in/")).toBeNull();
  });
});

describe("parseFollowers", () => {
  it("reads Instagram's follower count, with K and M", () => {
    expect(parseFollowers("175K Followers, 43 Following, 1,395 Posts - See Instagram photos")).toBe(175000);
    expect(parseFollowers("871 Followers, 1,223 Following, 15 Posts")).toBe(871);
    expect(parseFollowers("1.2M Followers, 10 Following")).toBe(1200000);
    expect(parseFollowers("12,345 Followers")).toBe(12345);
    expect(parseFollowers("See Instagram photos and videos")).toBeNull();
    expect(parseFollowers(null)).toBeNull();
  });
});
