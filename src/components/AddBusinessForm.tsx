"use client";

import { useState } from "react";
import type { LatLng, Place } from "@/lib/geo";
import { LocationPicker } from "./map/LocationPicker";

export type CityOption = { slug: string; name: string; center: LatLng | null; categories: { slug: string; name: string }[] };

type Props = { cities: CityOption[]; initialCity?: string; initialCategory?: string };

export function AddBusinessForm({ cities, initialCity, initialCategory }: Props) {
  const startCity = cities.find((c) => c.slug === initialCity) ?? cities[0];
  const [city, setCity] = useState(startCity?.slug ?? "");
  const [category, setCategory] = useState(
    (startCity?.categories.find((c) => c.slug === initialCategory) ?? startCity?.categories[0])?.slug ?? "",
  );
  const categories = cities.find((c) => c.slug === city)?.categories ?? [];
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function chooseCity(slug: string) {
    setCity(slug);
    setLocation(null); // a location belongs to one city
    const next = cities.find((c) => c.slug === slug)?.categories ?? [];
    if (!next.some((c) => c.slug === category)) setCategory(next[0]?.slug ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ city, category, name, link, email: email.trim() || null, location }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error);
      setDone(`${name.trim()} is in the review queue for ${data.city} → ${data.category}. We'll email you when it's live.`);
      setName("");
      setLink("");
      setLocation(null);
    } catch {
      setError("Something went wrong. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  if (!cities.length) {
    return <p className="card notice-info">No boards are open yet. Check back soon.</p>;
  }

  return (
    <form className="card form-grid add-form" onSubmit={submit} noValidate>
      <div className="field full">
        <label htmlFor="bizName">Business name</label>
        <input id="bizName" autoComplete="organization" placeholder="e.g. Monsoon Beans" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="bizCity">City</label>
        <select id="bizCity" value={city} onChange={(e) => chooseCity(e.target.value)}>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="bizCat">Category</label>
        <select id="bizCat" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field full">
        <label htmlFor="bizLink">Website, Instagram or Facebook link</label>
        <input id="bizLink" inputMode="url" autoComplete="url" placeholder="https://instagram.com/yourshop" maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} required />
      </div>
      <div className="full">
        <LocationPicker
          value={location}
          onChange={setLocation}
          required
          city={(() => {
            const c = cities.find((x) => x.slug === city);
            return c ? { slug: c.slug, name: c.name, center: c.center } : undefined;
          })()}
        />
      </div>
      <div className="field full">
        <label htmlFor="bizEmail">Your email (optional, for review updates)</label>
        <input id="bizEmail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="full notice notice-error" role="alert">{error}</p>}
      <div className="full">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</button>
      </div>
      {done && <p className="full notice notice-good" role="status">{done}</p>}
    </form>
  );
}
