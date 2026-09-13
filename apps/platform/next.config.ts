import { withContentCollections } from "@content-collections/next";
import { env } from "@repo/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Validated at config time (fails the build if missing in production) and inlined for the client.
  env: {
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
  },
  // PDF rendering runs in Node with vendored fonts; keep it out of the bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
  // The PDF renderer reads vendored TTFs at runtime; tracing cannot see them.
  // `lib/markdown-doc.tsx` reads `docs/` at build, which makes the tracer
  // copy the whole directory into the server bundle — 22 MB of spec
  // screenshots that no page ever reads at runtime.
  outputFileTracingExcludes: {
    "*": ["../../docs/specs/**"],
  },
  outputFileTracingIncludes: {
    "/api/certificates/[file]": ["../../packages/certificates/fonts/**"],
  },
  transpilePackages: [
    "@repo/ui",
    "@repo/database",
    "@repo/auth",
    "@repo/learning",
    "@repo/email",
    "@repo/notify",
    "@repo/storage",
    "@repo/certificates",
    "@repo/content-schema",
    "@repo/content",
  ],
  typedRoutes: true,
  turbopack: {
    resolveAlias: {
      // `@react-email/render` imports Prettier at module level for a `pretty`
      // option we never use; aliasing it away took 4.76 MB out of the Worker.
      // See lib/stubs/prettier.ts.
      "prettier/standalone": "./lib/stubs/prettier.ts",
      "prettier/plugins/html": "./lib/stubs/prettier.ts",
    },
  },
};

export default withContentCollections(nextConfig);
