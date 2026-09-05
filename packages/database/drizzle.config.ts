import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
  dialect: "postgresql",
  casing: "snake_case",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
  verbose: true,
});
