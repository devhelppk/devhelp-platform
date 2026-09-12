import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { cache } from "react";

/**
 * The session, read once per request.
 *
 * The shell, the account menu and the page itself all need to know who is
 * signed in; `cache` dedupes them so one render is one lookup rather than three
 * (the long-standing follow-up about `getSession` being called three times per
 * lesson page).
 */
export const shellSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
