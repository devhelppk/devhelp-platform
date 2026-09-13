import type { MetadataRoute } from "next";
import { clientEnv } from "@repo/env/client";

/**
 * What a crawler may read on the learning platform.
 *
 * Everything a learner reads is open — courses, lessons, company facts, public
 * profiles, certificate verification — because that openness is the product and
 * the company pages are the platform's main SEO entry point (F2.14). What is
 * disallowed is either somebody's own account, a staff tool, or not a page.
 */
export default function robots(): MetadataRoute.Robots {
  const base = clientEnv.NEXT_PUBLIC_LMS_URL.replace(/\/$/, "");
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
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
