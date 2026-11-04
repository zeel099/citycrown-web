export function normalizeName(name: string): string {
  // Apostrophes are dropped, not spaced, so "Zeel's Chai" and "Zeels Chai" match.
  return name.toLowerCase().normalize("NFKD").replace(/['\u2019]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function slugify(name: string): string {
  return normalizeName(name).replace(/ /g, "-");
}
