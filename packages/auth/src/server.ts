import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, schema } from "@repo/database";

/**
 * Platform-level roles live on `users.role` (managed by the admin plugin).
 * Organization-level roles (owner / admin / member) live on `members.role`.
 */
export const platformRoles = ["student", "mentor", "admin"] as const;

export const auth = betterAuth({
  appName: "devhelp",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  advanced: {
    database: { generateId: "uuid" },
    // Sessions on devhelp.pk and learn.devhelp.pk share one cookie in production.
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === "production",
      domain: ".devhelp.pk",
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  user: {
    additionalFields: {
      // e.g. "Karachi", "Lahore": used for cohorts and local meetups.
      city: { type: "string", required: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    admin({
      defaultRole: "student",
      adminRoles: ["admin"],
    }),
    organization({
      // Organizations are institutions and communities (universities, societies,
      // bootcamps, companies). Teams inside them are cohorts / batches.
      teams: { enabled: true },
      creatorRole: "owner",
      allowUserToCreateOrganization: async (user) =>
        user.role === "admin" || user.role === "mentor",
      membershipLimit: 5000,
      schema: {
        organization: {
          additionalFields: {
            kind: {
              type: [
                "university",
                "society",
                "bootcamp",
                "company",
                "community",
              ],
              required: false,
              defaultValue: "community",
              input: true,
            },
            city: { type: "string", required: false, input: true },
            website: { type: "string", required: false, input: true },
          },
        },
        team: {
          additionalFields: {
            startsAt: { type: "date", required: false, input: true },
            endsAt: { type: "date", required: false, input: true },
          },
        },
      },
    }),
    // Must stay last so Set-Cookie headers from server actions are applied.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
