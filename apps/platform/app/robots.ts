import type { MetadataRoute } from "next";
import { clientEnv } from "@repo/env/client";

/**
 * What a crawler may read on devhelp — one host for the marketing pages and
 * the learning platform.
 *
 * Everything a learner reads is open — courses, lessons, company facts, public
 * profiles, certificate verification, and the marketing pages (About,
 * Roadmap, Contribute, FAQ, the policy documents) — because that openness is
 * the product and the company pages are the platform's main SEO entry point
 * (F2.14). What is disallowed is either somebody's own account, a staff tool,
 * not a page, the signed-in dashboard (`/home`, indexing a per-user view is
 * pointless — the marketing `/` is the page to rank), or the contributor
 * style guide (`/design`, `noindex`d for the same reason).
 */
export default function robots(): MetadataRoute.Robots {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/moderate",
          "/studio",
          "/mentor",
          "/account",
          "/notifications",
          "/api/",
          "/sign-in",
          "/sign-up",
          "/reset-password",
          "/forgot-password",
          "/verify-email",
          // A search results page is thin, infinite, and duplicates the pages
          // it points at.
          "/search",
          "/home",
          "/design",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
