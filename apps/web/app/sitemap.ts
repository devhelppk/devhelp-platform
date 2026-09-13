import type { MetadataRoute } from "next";
import { clientEnv } from "@repo/env/client";

/**
 * The marketing pages. The LMS has its own sitemap on its own domain, because a
 * sitemap may only list URLs from the host that serves it.
 *
 * `/design` is deliberately absent: it is a style guide for people building the
 * thing, not a page for readers, and `robots.ts` tells crawlers the same.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = clientEnv.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
  const updated = new Date();
  // `as const` on each `changeFrequency`: the array is mapped, and without it
  // the literal widens to `string` and stops matching `MetadataRoute.Sitemap`.
  return [
    { url: `${base}/`, changeFrequency: "weekly" as const, priority: 1 },
    {
      url: `${base}/about`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${base}/roadmap`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${base}/contribute`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    { url: `${base}/faq`, changeFrequency: "monthly" as const, priority: 0.6 },
    {
      url: `${base}/policy`,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    },
    {
      url: `${base}/privacy`,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    },
    { url: `${base}/terms`, changeFrequency: "yearly" as const, priority: 0.4 },
  ].map((e) => ({ ...e, lastModified: updated }));
}
