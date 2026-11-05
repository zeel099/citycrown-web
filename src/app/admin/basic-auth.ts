// Edge-safe: imported by src/middleware.ts as well as the admin server actions.

/** Basic auth for the admin area. Replace with real staff accounts and 2FA before launch (NFR-05). */
export function checkBasicAuth(header: string | null, env: { user?: string; pass?: string } = adminEnv()): boolean {
  const { user, pass } = env;
  if (!user || !pass || !header) return false;
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  return sameString(decoded, `${user}:${pass}`);
}

const adminEnv = () => ({ user: process.env.ADMIN_USER, pass: process.env.ADMIN_PASSWORD });

/** Compares without returning early, so response time doesn't hint at the password. */
function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
