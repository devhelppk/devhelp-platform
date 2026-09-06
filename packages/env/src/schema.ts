import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined));

export const serverSchema = {
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)",
    ),
  BETTER_AUTH_URL: z.url(),
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  CONTENT_DIR: optionalString,
  CONTENT_SYNC_SECRET: optionalString,
  /** Where email goes: Resend's API, any SMTP server (Mailpit locally), or an in-memory outbox that also logs. */
  EMAIL_PROVIDER: z.enum(["resend", "smtp", "log"]).default("log"),
  EMAIL_FROM: z.string().min(3).default("devhelp <no-reply@devhelp.pk>"),
  RESEND_API_KEY: optionalString,
  SMTP_URL: optionalString,
  /** Object storage: `s3` everywhere (R2 in production, MinIO locally and in CI); `fs` is for unit tests. */
  STORAGE_DRIVER: z.enum(["s3", "fs"]).default("s3"),
  STORAGE_FS_DIR: optionalString,
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
};

const isProduction = process.env.NODE_ENV === "production";

/** Localhost defaults are a development convenience only; production must set both. */
export const clientSchema = {
  NEXT_PUBLIC_LMS_URL: isProduction
    ? z.url()
    : z.url().default("http://localhost:3001"),
  NEXT_PUBLIC_WEB_URL: isProduction
    ? z.url()
    : z.url().default("http://localhost:3000"),
};

/** The subset the database package needs: drizzle-kit and the seed must not require auth secrets. */
export const databaseSchema = {
  DATABASE_URL: serverSchema.DATABASE_URL,
  DATABASE_POOL_MAX: serverSchema.DATABASE_POOL_MAX,
};

/**
 * OAuth providers need both halves or neither; the email provider needs its
 * credentials. Whether `log` is allowed in production is checked when the
 * first email is sent (`@repo/email`), not here: `next build` and `typegen`
 * run with NODE_ENV=production and must not need mail credentials.
 */
export function checkPairs(env: {
  NODE_ENV?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  EMAIL_PROVIDER?: "resend" | "smtp" | "log";
  RESEND_API_KEY?: string;
  SMTP_URL?: string;
  STORAGE_DRIVER?: "s3" | "fs";
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
}) {
  const problems: string[] = [];
  if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY)
    problems.push("EMAIL_PROVIDER=resend needs RESEND_API_KEY");
  if (env.EMAIL_PROVIDER === "smtp" && !env.SMTP_URL)
    problems.push(
      "EMAIL_PROVIDER=smtp needs SMTP_URL (e.g. smtp://localhost:1025)",
    );
  if (
    env.STORAGE_DRIVER === "s3" &&
    (!env.S3_ENDPOINT ||
      !env.S3_BUCKET ||
      !env.S3_ACCESS_KEY_ID ||
      !env.S3_SECRET_ACCESS_KEY)
  )
    problems.push(
      "STORAGE_DRIVER=s3 needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (pnpm db:up starts MinIO with the .env.example values)",
    );

  if (!!env.GITHUB_CLIENT_ID !== !!env.GITHUB_CLIENT_SECRET)
    problems.push(
      "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together",
    );
  if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET)
    problems.push(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
    );
  return problems;
}
