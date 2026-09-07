import { db, eq, schema } from "@repo/database";
import { getStorage } from "@repo/storage";
import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import {
  ICON_MAX_BYTES,
  ICON_TYPES,
  monogramSvg,
  pickIconUrl,
  RECHECK_AFTER_DAYS,
  walkRedirects,
} from "@/lib/favicon";

/**
 * GET /api/company-logos/<org uuid>: a company's mark. In order of preference
 * an uploaded logo, the icon its own website advertises (fetched once and
 * cached in our bucket, so a reader's browser never talks to the company's
 * site), and a generated monogram.
 *
 * It never 404s for a published company, which is why callers can render an
 * `<img>` unconditionally and never show a broken image.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  const id = file.replace(/\.[a-z0-9]+$/i, "");
  if (!/^[0-9a-f-]{36}$/.test(id))
    return new NextResponse("Not found", { status: 404 });
  const row = await db.query.companyProfiles.findFirst({
    where: eq(schema.companyProfiles.organizationId, id),
    columns: { logoKey: true, faviconKey: true, faviconCheckedAt: true },
    with: { organization: { columns: { name: true, website: true } } },
  });
  // Any company row, not just a published one: the admin editing a pending
  // proposal needs its mark too, and a mark reveals nothing that knowing the
  // uuid does not already.
  if (!row) return new NextResponse("Not found", { status: 404 });
  const storage = getStorage();

  const key = row.logoKey ?? row.faviconKey;
  if (key) {
    const object = await storage.get(key);
    if (object) return image(object.bytes, object.contentType, true);
  }

  // Nothing stored: try the company's own site, at most once a month.
  const due =
    !row.faviconCheckedAt ||
    Date.now() - row.faviconCheckedAt.getTime() >
      RECHECK_AFTER_DAYS * 86_400_000;
  if (due && row.organization?.website) {
    // Stamp the attempt first, so concurrent requests do not all go fetching.
    await db
      .update(schema.companyProfiles)
      .set({ faviconCheckedAt: new Date() })
      .where(eq(schema.companyProfiles.organizationId, id));
    const fetched = await fetchIcon(row.organization.website);
    if (fetched) {
      const iconKey = `companies/${id}/favicon-${Date.now()}.${fetched.ext}`;
      await storage.put(iconKey, fetched.bytes, fetched.contentType);
      await db
        .update(schema.companyProfiles)
        .set({ faviconKey: iconKey })
        .where(eq(schema.companyProfiles.organizationId, id));
      // The previous icon is nobody's now. Without this, every monthly
      // re-check would leave another copy in the bucket for ever.
      if (row.faviconKey && row.faviconKey !== iconKey)
        await storage.delete(row.faviconKey).catch(() => {});
      return image(fetched.bytes, fetched.contentType, true);
    }
  }

  // A monogram is cached briefly, so it gives way once a real mark arrives.
  return image(
    new TextEncoder().encode(monogramSvg(row.organization?.name ?? "?")),
    "image/svg+xml",
    false,
  );
}

function image(bytes: Uint8Array, contentType: string, stored: boolean) {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": contentType,
      // These bytes can be an admin's SVG, so treat them as untrusted markup:
      // no sniffing to a different type, and nothing inside may execute if
      // somebody opens the URL directly rather than rendering it in an `img`.
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "cache-control": stored
        ? "public, max-age=300, s-maxage=86400"
        : "public, max-age=60, s-maxage=300",
    },
  });
}

/**
 * Fetch a URL the company supplied, refusing to be pointed at our own network.
 *
 * Redirects are followed by hand, one hop at a time, because `redirect:
 * "follow"` would check only the first URL and a 302 to `169.254.169.254` would
 * sail past. Every hop is re-validated, and a hostname is resolved and its
 * address checked, because a public name can point at a private address.
 *
 * What this cannot close is DNS rebinding: Node's fetch resolves again on its
 * own, so a name that answers differently between our check and its connection
 * could still slip through. Closing that needs a pinned-socket agent; the
 * fetched bytes are only ever served back as a non-executable image, and the
 * remaining exposure is a blind request, not a readable one.
 */
async function safeFetch(target: string, accept: string) {
  let final: Response | null = null;
  const hop = await walkRedirects(target, {
    resolve: async (host) =>
      (await lookup(host, { all: true })).map((a) => a.address),
    request: async (url) => {
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: { accept },
      });
      final = res;
      return { status: res.status, location: res.headers.get("location") };
    },
  });
  if (!hop || !final || !(final as Response).ok) return null;
  return { res: final as Response, url: hop.url };
}

/** Read the site's declared icon. Every failure is a shrug: we fall back. */
async function fetchIcon(website: string) {
  try {
    const page = await safeFetch(website, "text/html");
    if (!page) return null;
    const html = (await page.res.text()).slice(0, 200_000);
    const iconUrl = pickIconUrl(html, page.url);
    if (!iconUrl) return null;
    const icon = await safeFetch(iconUrl, "image/*");
    if (!icon) return null;
    const contentType = (icon.res.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    const ext = ICON_TYPES[contentType];
    if (!ext) return null;
    const buf = new Uint8Array(await icon.res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > ICON_MAX_BYTES) return null;
    return { bytes: buf, contentType, ext };
  } catch {
    return null;
  }
}
