import { db, schema } from "./index";

/**
 * Dev fixtures only. Course content is not seeded here: it comes from the
 * content repo (`pnpm content:refresh` = pull + check + sync). Idempotent and
 * never touches an existing account.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production.");
  }
  await db
    .insert(schema.users)
    .values({
      email: "team@devhelp.pk",
      name: "devhelp team",
      role: "admin",
      city: "Karachi",
    })
    .onConflictDoNothing();
  console.log(
    "Seeded dev admin user (team@devhelp.pk). Run `pnpm content:refresh` for courses.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
