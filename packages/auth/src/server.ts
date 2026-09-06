import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, schema } from "@repo/database";
import { env } from "@repo/env";
import { createElement } from "react";

/** Loaded on first use: templates pull in react-email, which getSession must not pay for. */
const email = () => import("@repo/email");

/**
 * Platform-level roles live on `users.role` (managed by the admin plugin).
 * Organization-level roles (owner / admin / member) live on `members.role`.
 */
export const platformRoles = ["student", "mentor", "admin"] as const;

export const auth = betterAuth({
  appName: "devhelp",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_WEB_URL, env.NEXT_PUBLIC_LMS_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  advanced: {
    database: { generateId: "uuid" },
    // Sessions on devhelp.pk and learn.devhelp.pk share one cookie in production.
    crossSubDomainCookies: {
      enabled: env.NODE_ENV === "production",
      domain: ".devhelp.pk",
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Verification gates contributing (verifiedProcedure), never learning or signing in.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      const { sendEmail, ResetPassword } = await email();
      await sendEmail({
        to: user.email,
        subject: "Reset your devhelp password",
        react: createElement(ResetPassword, { name: user.name, url }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      const { sendEmail, VerifyEmail } = await email();
      try {
        await sendEmail({
          to: user.email,
          subject: "Confirm your email for devhelp",
          react: createElement(VerifyEmail, { name: user.name, url }),
        });
      } catch (e) {
        // On sign-up the account must still be created and signed in; the
        // account page offers a resend. An explicit resend surfaces the error.
        if (request?.url.includes("send-verification-email")) throw e;
        console.error(`[auth] verification email to ${user.email} failed:`, e);
      }
    },
  },
  socialProviders: {
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
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
    // The cookie cache only sees its own copy of the user, so role and
    // verification changes are read fresh where they matter (mentorProcedure,
    // verifiedProcedure, the /moderate pages) instead of waiting it out.
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
      invitationExpiresIn: 60 * 60 * 48,
      sendInvitationEmail: async (data) => {
        const { sendEmail, OrganizationInvitation } = await email();
        const url = `${env.NEXT_PUBLIC_LMS_URL}/accept-invitation/${data.id}`;
        await sendEmail({
          to: data.email,
          subject: `${data.inviter.user.name} invited you to ${data.organization.name} on devhelp`,
          react: createElement(OrganizationInvitation, {
            inviter: data.inviter.user.name,
            organization: data.organization.name,
            url,
            expiresIn: "48 hours",
          }),
        });
      },
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
