import { createEnv } from "@t3-oss/env-nextjs";
import { loadRootEnv } from "./load";
import { checkPairs, clientSchema, serverSchema } from "./schema";

loadRootEnv();

/**
 * Validated environment. Import from server code only (`@repo/env`);
 * client components import `@repo/env/client`. Fails fast at boot/build.
 */
export const env = createEnv({
  server: serverSchema,
  client: clientSchema,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CONTENT_DIR: process.env.CONTENT_DIR,
    CONTENT_SYNC_SECRET: process.env.CONTENT_SYNC_SECRET,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_URL: process.env.SMTP_URL,
    NEXT_PUBLIC_LMS_URL: process.env.NEXT_PUBLIC_LMS_URL,
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
  onValidationError: (issues) => {
    throw new Error(
      "Invalid environment:\n" +
        issues
          .map((i) => `  ${i.path?.join(".") ?? "?"}: ${i.message}`)
          .join("\n"),
    );
  },
});

const pairProblems = checkPairs(env);
if (pairProblems.length && process.env.SKIP_ENV_VALIDATION !== "1") {
  throw new Error(
    "Invalid environment:\n" + pairProblems.map((p) => `  ${p}`).join("\n"),
  );
}
