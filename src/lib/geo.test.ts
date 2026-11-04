import { describe, expect, it } from "vitest";
import { coordsFromMapsLink, directionsUrl, distanceKm, formatDistance, isMapsLink, isValidLatLng } from "./geo";

describe("distance", () => {
  it("measures straight-line distance between two points", () => {
    const surat = { lat: 21.1702, lng: 72.8311 };
    const mumbai = { lat: 19.076, lng: 72.8777 };
    expect(distanceKm(surat, mumbai)).toBeGreaterThan(230);
    expect(distanceKm(surat, mumbai)).toBeLessThan(235);
    expect(distanceKm(surat, surat)).toBe(0);
  });

  it("reads distances the way people say them", () => {
    expect(formatDistance(0.004)).toBe("10 m");
    expect(formatDistance(0.648)).toBe("650 m");
    expect(formatDistance(2.34)).toBe("2.3 km");
    expect(formatDistance(27.8)).toBe("28 km");
  });

  it("links to Google Maps directions", () => {
    expect(directionsUrl({ lat: 21.17, lng: 72.83 })).toBe("https://www.google.com/maps/dir/?api=1&destination=21.170000,72.830000");
  });

  it("rejects impossible coordinates", () => {
    expect(isValidLatLng({ lat: 21.17, lng: 72.83 })).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 72 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 72 })).toBe(false);
  });
});

describe("Google Maps links", () => {
  it("recognises Maps links, including share links", () => {
    expect(isMapsLink("https://maps.app.goo.gl/AbC123")).toBe(true);
    expect(isMapsLink("https://www.google.com/maps/place/Chai/@21.17,72.83,17z")).toBe(true);
    expect(isMapsLink("https://goo.gl/maps/xyz")).toBe(true);
    expect(isMapsLink("https://www.google.com/search?q=cafe")).toBe(false);
    expect(isMapsLink("https://evil.example/maps")).toBe(false);
  });

  it("prefers the place pin over the map centre", () => {
    const url = "https://www.google.com/maps/place/Third+Wave+Coffee/@21.1800,72.8000,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d21.1832!4d72.8124";
    expect(coordsFromMapsLink(url)).toEqual({ lat: 21.1832, lng: 72.8124 });
  });

  it("reads centre, query and search forms", () => {
    expect(coordsFromMapsLink("https://www.google.com/maps/@21.17,72.83,17z")).toEqual({ lat: 21.17, lng: 72.83 });
    expect(coordsFromMapsLink("https://maps.google.com/?q=21.1702,72.8311")).toEqual({ lat: 21.1702, lng: 72.8311 });
    expect(coordsFromMapsLink("https://www.google.com/maps/search/?api=1&query=19.0760,72.8777")).toEqual({ lat: 19.076, lng: 72.8777 });
    expect(coordsFromMapsLink("https://www.google.com/maps/place/21.1702,+72.8311")).toEqual({ lat: 21.1702, lng: 72.8311 });
    expect(coordsFromMapsLink("https://www.google.com/maps/place/Some+Cafe")).toBeNull();
  });
});
