import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { organizations } from "./auth";
import { contributionStatus } from "./companies";
import type { ClaimEvidence } from "./json";

/**
 * Company claims and public responses (S13). S10a decided a company is an
 * organisation, so "this person represents this company" is ordinary
 * membership — approving a claim adds a row to `members` and this table
 * becomes history.
 */
export const claimStatus = pgEnum("claim_status", [
  "pending",
  "approved",
  "rejected",
]);

export const companyClaims = pgTable(
  "company_claims",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: claimStatus().notNull().default("pending"),
    /** What was checked and what it showed, so a decision can be re-read later. */
    evidence: jsonb().$type<ClaimEvidence>().notNull(),
    message: text(),
    decidedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("company_claims_uidx").on(t.organizationId, t.userId),
    index("company_claims_status_idx").on(t.status, t.createdAt),
  ],
);

/**
 * A company's public answer to a review or an interview experience. One per
 * post: a right of reply, not a thread. Markdown is rendered and sanitised on
 * the server at write time, exactly as S6 does for every other piece of
 * learner prose.
 */
export const companyResponses = pgTable(
  "company_responses",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subjectType: text().notNull(),
    subjectId: uuid().notNull(),
    /** The member who wrote it: shown as the company, kept for moderation. */
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    body: text().notNull(),
    bodyHtml: text().notNull(),
    status: contributionStatus().notNull().default("pending"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("company_responses_subject_uidx").on(
      t.subjectType,
      t.subjectId,
    ),
    index("company_responses_org_idx").on(t.organizationId, t.status),
  ],
);

export const companyClaimsRelations = relations(companyClaims, ({ one }) => ({
  organization: one(organizations, {
    fields: [companyClaims.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [companyClaims.userId], references: [users.id] }),
}));

export const companyResponsesRelations = relations(
  companyResponses,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [companyResponses.organizationId],
      references: [organizations.id],
    }),
  }),
);

/** What a reader may see of a response: never the person who wrote it. */
export const responsePublicColumns = {
  id: companyResponses.id,
  subjectType: companyResponses.subjectType,
  subjectId: companyResponses.subjectId,
  bodyHtml: companyResponses.bodyHtml,
  createdAt: companyResponses.createdAt,
  updatedAt: companyResponses.updatedAt,
} as const;
