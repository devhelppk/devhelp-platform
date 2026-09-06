import { withContentCollections } from "@content-collections/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@repo/ui",
    "@repo/database",
    "@repo/auth",
    "@repo/learning",
    "@repo/content-schema",
    "@repo/content",
  ],
  typedRoutes: true,
};

export default withContentCollections(nextConfig);
