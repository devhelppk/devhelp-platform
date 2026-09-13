import type { MetadataRoute } from "next";
import { clientEnv } from "@repo/env/client";

export default function robots(): MetadataRoute.Robots {
  const base = clientEnv.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The style guide is for contributors, and the auth routes are not
        // pages at all.
        disallow: ["/design", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
