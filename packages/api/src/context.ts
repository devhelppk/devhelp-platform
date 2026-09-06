import { auth, type Session } from "@repo/auth";
import { db } from "@repo/database";

export type Context = {
  db: typeof db;
  session: Session | null;
  headers: Headers;
};

/** Build the per-request context from incoming headers (route handler or RSC). */
export async function createContext(headers: Headers): Promise<Context> {
  const session = await auth.api.getSession({ headers });
  return { db, session, headers };
}
