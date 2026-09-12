#!/usr/bin/env tsx
/**
 * Create (or re-password) a dev admin that can actually sign in.
 *
 * `pnpm db:seed` inserts `team@devhelp.pk` as a `users` row with **no
 * credential account**, so nobody can ever sign in as it — a fresh checkout has
 * an admin that exists and cannot be used, which is how this script came to be.
 *
 * The password goes through Better Auth's own sign-up, so the hash is whatever
 * the configured hasher produces rather than something handmade that happens to
 * work today. The account is then promoted to `admin` and marked verified, since
 * `verifiedProcedure` gates contributing and an admin testing the queue needs to
 * be past that.
 *
 * Development only: refuses to run against production, like the seed.
 *
 *   pnpm dev:admin                        # devadmin@devhelp.test, generated password
 *   pnpm dev:admin me@example.com hunter2 # explicit
 */
import { randomBytes } from "node:crypto";
import { db, eq, schema } from "@repo/database";
import { auth } from "../src/server";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to create a dev admin in production.");
  }
  const email = process.argv[2] ?? "devadmin@devhelp.test";
  // 18 bytes of base64url clears the 8-character minimum with room to spare.
  const password = process.argv[3] ?? randomBytes(18).toString("base64url");

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (existing) {
    // Sign-up would fail on the unique email, so reset the password instead.
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(password);
    const account = await db.query.accounts.findFirst({
      where: eq(schema.accounts.userId, existing.id),
    });
    if (account) {
      await db
        .update(schema.accounts)
        .set({ password: hash })
        .where(eq(schema.accounts.id, account.id));
    } else {
      await db.insert(schema.accounts).values({
        userId: existing.id,
        accountId: existing.id,
        providerId: "credential",
        password: hash,
      });
    }
  } else {
    await auth.api.signUpEmail({
      body: { email, password, name: "Dev Admin" },
    });
  }

  await db
    .update(schema.users)
    .set({ role: "admin", emailVerified: true })
    .where(eq(schema.users.email, email));

  console.log(`\nDev admin ready — sign in at /sign-in\n`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}\n`);
  console.log(
    "Local fixture only. It is printed because it is meant to be typed by a\n" +
      "person, and it is not stored anywhere else.\n",
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
