import { createEnv } from "@t3-oss/env-nextjs";
import { clientSchema } from "./schema";

/** Browser-safe env (NEXT_PUBLIC_* only); inlined by Next at build time. */
export const clientEnv = createEnv({
  client: clientSchema,
  runtimeEnv: {
    NEXT_PUBLIC_LMS_URL: process.env.NEXT_PUBLIC_LMS_URL,
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
  },
  emptyStringAsUndefined: true,
});
