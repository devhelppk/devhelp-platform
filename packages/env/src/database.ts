import { createEnv } from "@t3-oss/env-nextjs";
import { databaseSchema } from "./schema";
import { loadRootEnv } from "./load";

loadRootEnv();

/** Database-only env for drizzle-kit, the seed, and the client; no auth vars required. */
export const databaseEnv = createEnv({
  server: databaseSchema,
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
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
