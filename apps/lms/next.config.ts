import { withContentCollections } from "@content-collections/next";
import { env } from "@repo/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Validated at config time (fails the build if missing in production) and inlined for the client.
  env: {
    NEXT_PUBLIC_LMS_URL: env.NEXT_PUBLIC_LMS_URL,
    NEXT_PUBLIC_WEB_URL: env.NEXT_PUBLIC_WEB_URL,
  },
  transpilePackages: [
    "@repo/ui",
    "@repo/database",
    "@repo/auth",
    "@repo/learning",
    "@repo/email",
    "@repo/notify",
    "@repo/content-schema",
    "@repo/content",
  ],
  typedRoutes: true,
};

export default withContentCollections(nextConfig);
