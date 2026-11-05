import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";

// FR-ADM-03: checks that a submitted link answers before a moderator looks at it.
// The server fetches a URL someone typed, so it only follows public https URLs,
// gives up quickly and never reads more than a small page.

export type LinkCheck = { ok: boolean; note: string };
type Resolve = (host: string) => Promise<string[]>;

const TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

// Two lists: a BlockList also matches IPv4 lookups against IPv4-mapped IPv6 rules.
const PRIVATE_V4 = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) PRIVATE_V4.addSubnet(prefix, bits, "ipv4");
// Includes the IPv4-mapped, NAT64, Teredo and 6to4 ranges, which can wrap a private IPv4 address.
const PRIVATE_V6 = new net.BlockList();
for (const [prefix, bits] of [
  ["::", 127], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["100::", 64], ["2001::", 32], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) PRIVATE_V6.addSubnet(prefix, bits, "ipv6");

/** Loopback, private, link-local, reserved or anything that isn't an IP address. */
export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return PRIVATE_V4.check(ip, "ipv4");
  if (family === 6) return PRIVATE_V6.check(ip, "ipv6");
  return true;
}

const bareHost = (url: URL) => url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();

/** "instagram.com" for https://www.instagram.com/shop, as shown to moderators. */
export const hostLabel = (url: URL) => bareHost(url).replace(/^www\./, "");

/** Why the server won't fetch this URL, or null when it may. */
export function unsafeReason(url: URL): string | null {
  if (url.protocol !== "https:") return "not an https link";
  if (url.username || url.password) return "link has a username or password";
  if (url.port && url.port !== "443") return "non-standard port";
  const host = bareHost(url);
  if (net.isIP(host)) return isPrivateAddress(host) ? "private address" : null;
  if (!host.includes(".") || /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home\.arpa)$/.test(host)) {
    return "private address";
  }
  return null;
}

const lookupAll: Resolve = async (host) => (await dns.lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Fetches the link and reports whether it answers with a 2xx page, following up to
 * three redirects. Every hop is re-checked, and the connection is pinned to the
 * address that was checked so a second DNS answer can't point it somewhere private.
 */
export async function checkLink(input: string, opts: { resolve?: Resolve; timeoutMs?: number } = {}): Promise<LinkCheck> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, note: "invalid link" };
  }
  const label = hostLabel(url);
  const signal = AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const reason = unsafeReason(url);
      if (reason) return { ok: false, note: `${label}: ${reason}` };
      const host = bareHost(url);
      const addresses = net.isIP(host) ? [host] : await abortable((opts.resolve ?? lookupAll)(host), signal);
      if (!addresses.length) return { ok: false, note: `${label}: unreachable` };
      if (addresses.some(isPrivateAddress)) return { ok: false, note: `${label}: private address` };

      const { status, location } = await fetchStatus(url, addresses[0], signal);
      if (status >= 300 && status < 400 && location) {
        url = new URL(location, url);
        continue;
      }
      return status >= 200 && status < 300 ? { ok: true, note: `${label}: OK` } : { ok: false, note: `${label}: HTTP ${status}` };
    }
    return { ok: false, note: `${label}: too many redirects` };
  } catch {
    return { ok: false, note: `${label}: ${signal.aborted ? "timed out" : "unreachable"}` };
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    promise.then(resolve, reject);
  });
}

function fetchStatus(url: URL, address: string, signal: AbortSignal): Promise<{ status: number; location?: string }> {
  const family = net.isIP(address);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        agent: false,
        signal,
        headers: { "user-agent": "BestInTheCity-LinkCheck/1.0", accept: "text/html,*/*;q=0.8" },
        lookup: (_host, options, callback) =>
          options.all ? callback(null, [{ address, family }]) : callback(null, address, family),
      },
      (res) => {
        const result = { status: res.statusCode ?? 0, location: res.headers.location };
        const finish = () => {
          res.destroy();
          resolve(result);
        };
        if (result.status >= 300 && result.status < 400) return finish();
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) finish();
        });
        res.on("end", finish);
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}
