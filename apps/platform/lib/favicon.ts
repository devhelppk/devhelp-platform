import { companyInitials } from "./logo";

/**
 * A company's mark, when nobody has uploaded one: fetch the icon its own
 * website advertises, once, and cache it in object storage. Readers are served
 * from our bucket, so their browsers never talk to the company's site or to a
 * third-party favicon service.
 */

/**
 * Icon types worth storing from someone else's website. **No SVG**: an SVG can
 * carry script, and anything we store is served back from our own origin, so a
 * company site under an attacker's control could otherwise plant a script that
 * runs on the LMS origin for anyone who opened the image URL directly. An
 * admin-uploaded SVG is a different trust level and stays allowed; the route
 * serves everything with `nosniff` and a no-script CSP regardless.
 */
export const ICON_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};
export const ICON_MAX_BYTES = 512 * 1024;
/** How long a failure stands before we try that site again. */
export const RECHECK_AFTER_DAYS = 30;

/**
 * Refuse anything that is not a public http(s) URL. A company website can
 * reach us from a proposal, so this fetch must never be talked into calling
 * localhost, a cloud metadata endpoint, or a private address.
 */
export function isSafeIconUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "metadata.google.internal") return false;
  // A literal address must be a public one. A *name* is checked separately,
  // after resolution, because a name can point anywhere (see `isPublicAddress`).
  if (isIpLiteral(host)) return isPublicAddress(host);
  return true;
}

/** Does this hostname look like an IP literal rather than a name? */
export function isIpLiteral(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

/**
 * Is this address one we are willing to talk to? Everything private, loopback,
 * link-local (the cloud metadata range included), and multicast is refused.
 */
export function isPublicAddress(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPublicIpv4(host);
  if (host.includes(":")) return isPublicIpv6(host);
  return false;
}

function isPublicIpv4(host: string) {
  const p = host.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255))
    return false;
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a >= 224) return false;
  return true;
}

/**
 * Expand an IPv6 address to its eight 16-bit groups, or null if it is not one.
 * Doing this properly matters: `new URL()` rewrites
 * `http://[::ffff:169.254.169.254]/` to the hex form `[::ffff:a9fe:a9fe]`, so
 * a check that only looks for the dotted spelling never sees the address the
 * server would actually connect to.
 */
export function expandIpv6(host: string): number[] | null {
  if (!host.includes(":")) return null;
  // A trailing dotted quad (`::ffff:1.2.3.4`) becomes two hex groups.
  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  let text = host;
  if (dotted) {
    const q = dotted[2]!.split(".").map(Number);
    if (q.some((n) => Number.isNaN(n) || n > 255)) return null;
    text = `${dotted[1]}${((q[0]! << 8) | q[1]!).toString(16)}:${(
      (q[2]! << 8) |
      q[3]!
    ).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) =>
    part === "" ? [] : part.split(":").map((g) => Number.parseInt(g, 16));
  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  const groups =
    halves.length === 2
      ? [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail]
      : head;
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g > 0xffff))
    return null;
  return groups;
}

function isPublicIpv6(host: string) {
  const g = expandIpv6(host);
  if (!g) return false;
  const [a, b] = g as number[] & { 0: number; 1: number };
  // Unspecified (::) and loopback (::1).
  if (g.every((x, i) => (i === 7 ? x === 1 || x === 0 : x === 0))) return false;
  // IPv4-mapped (::ffff:0:0/96): only as safe as the address it carries.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    const v4 = `${g[6]! >> 8}.${g[6]! & 0xff}.${g[7]! >> 8}.${g[7]! & 0xff}`;
    return isPublicIpv4(v4);
  }
  // IPv4-compatible (::a.b.c.d), deprecated but still routable to loopback.
  if (g.slice(0, 6).every((x) => x === 0)) return false;
  if ((a! & 0xfe00) === 0xfc00) return false; // fc00::/7, unique-local
  if ((a! & 0xffc0) === 0xfe80) return false; // fe80::/10, link-local
  void b;
  return true;
}

/**
 * The icon a page advertises, as an absolute URL. Prefers a declared icon over
 * the conventional `/favicon.ico`, and a larger declared size over a smaller.
 */
export function pickIconUrl(html: string, pageUrl: string): string | null {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  let best: { href: string; size: number } | null = null;
  for (const tag of links) {
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase();
    if (!rel) continue;
    const rels = rel.split(/\s+/);
    if (
      !rels.includes("icon") &&
      !rels.includes("shortcut") &&
      !rels.includes("apple-touch-icon")
    )
      continue;
    const href = /\bhref\s*=\s*["']([^"']+)/i.exec(tag)?.[1];
    if (!href) continue;
    const sizes = /\bsizes\s*=\s*["']?(\d+)/i.exec(tag)?.[1];
    // An apple-touch-icon is usually the biggest thing on offer.
    const size = sizes
      ? Number(sizes)
      : rels.includes("apple-touch-icon")
        ? 180
        : 32;
    if (!best || size > best.size) best = { href, size };
  }
  try {
    const base = new URL(pageUrl);
    return new URL(best?.href ?? "/favicon.ico", base).toString();
  } catch {
    return null;
  }
}

/** A plain monogram, so a company with no mark still looks finished. */
export function monogramSvg(name: string) {
  const initials = companyInitials(name);
  // A stable hue from the name: the same company is always the same colour.
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${initials}"><rect width="64" height="64" rx="10" fill="hsl(${hash} 45% 92%)"/><text x="32" y="41" font-family="system-ui, sans-serif" font-size="26" font-weight="600" text-anchor="middle" fill="hsl(${hash} 40% 35%)">${initials}</text></svg>`;
}

export type Hop = {
  status: number;
  location?: string | null;
  contentLength?: number | null;
};

/** Refuse an oversized body before reading it, when the server declares one. */
export function tooBig(contentLength: number | null | undefined, max: number) {
  return typeof contentLength === "number" && contentLength > max;
}

/**
 * Walk a redirect chain, deciding at every hop whether we are willing to make
 * the request. Separated from the fetching so the decision can be tested: the
 * bypass this exists to stop is a public URL that 302s to `169.254.169.254`,
 * which a single up-front check never sees.
 *
 * `resolve` maps a hostname to its addresses; every one must be public,
 * because a public name can point anywhere.
 */
export async function walkRedirects(
  start: string,
  opts: {
    request: (url: string) => Promise<Hop>;
    resolve: (host: string) => Promise<string[]>;
    maxHops?: number;
  },
): Promise<{ url: string; status: number } | null> {
  let url = start;
  const max = opts.maxHops ?? 4;
  for (let hop = 0; hop < max; hop++) {
    if (!isSafeIconUrl(url)) return null;
    const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!isIpLiteral(host)) {
      const addresses = await opts.resolve(host).catch(() => []);
      if (!addresses.length) return null;
      if (!addresses.every(isPublicAddress)) return null;
    }
    const res = await opts.request(url);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) return null;
      url = new URL(res.location, url).toString();
      continue;
    }
    return { url, status: res.status };
  }
  return null;
}
