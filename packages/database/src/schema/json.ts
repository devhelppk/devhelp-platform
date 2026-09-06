import { z } from "zod";

/**
 * Zod schemas for every jsonb column. Drizzle's `.$type<>()` gives compile-time
 * shape; these give runtime validation at write boundaries (sync, seed,
 * @repo/learning). Infer the TS types from here so they cannot drift.
 */

export const completionCriteriaSchema = z
  .object({
    requireAllRequiredLessons: z.boolean().optional(),
    minQuizScore: z.number().int().min(0).max(100).optional(),
    requireProjectAccepted: z.boolean().optional(),
  })
  .strict();
export type CompletionCriteria = z.infer<typeof completionCriteriaSchema>;

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** Server-only. Never send to the client; use `questionPublicColumns`. */
  isCorrect: z.boolean(),
  feedback: z.string().optional(),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;
export const questionOptionsSchema = z.array(questionOptionSchema);

/** Accepted answers for `short` questions. Server-only. */
export const questionAnswerSchema = z.array(z.string().min(1)).min(1);
export type QuestionAnswer = z.infer<typeof questionAnswerSchema>;

/** A file map for the browser runner: path -> contents. */
export const fileMapSchema = z.record(z.string().min(1), z.string());
export type FileMap = z.infer<typeof fileMapSchema>;

export const progressEventPayloadSchema = z.record(z.string(), z.unknown());
export type ProgressEventPayload = z.infer<typeof progressEventPayloadSchema>;

/** A learner's answers to a quiz: option ids for single/multi, free text for short. */
export const quizAnswersSchema = z.array(
  z.object({
    questionId: z.uuid(),
    value: z.union([z.string(), z.array(z.string())]),
  }),
);
export type QuizAnswers = z.infer<typeof quizAnswersSchema>;

/** Per-question grading snapshot, frozen at submit time so regrading and history survive content changes. */
export const quizSnapshotSchema = z.array(
  z.object({
    questionId: z.uuid(),
    version: z.number().int(),
    points: z.number().int(),
    earned: z.number().int(),
    correct: z.boolean(),
  }),
);
export type QuizSnapshot = z.infer<typeof quizSnapshotSchema>;

/** Results reported by the exercise runner (browser harness or Node parity run). */
export const exerciseResultsSchema = z.array(
  z.object({
    name: z.string().min(1),
    passed: z.boolean(),
    error: z.string().optional(),
    durationMs: z.number().optional(),
  }),
);
export type ExerciseResults = z.infer<typeof exerciseResultsSchema>;

/** What a mentor applicant submits (F3.7); snapshotted on the moderation item. */
export const mentorApplicationSchema = z
  .object({
    tracks: z.array(z.enum(["technical", "career"])).min(1),
    github: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9-]{1,39}$/, "GitHub handle only, no URL"),
    why: z.string().trim().min(40).max(2000),
    link: z.url().optional(),
  })
  .strict();
export type MentorApplication = z.infer<typeof mentorApplicationSchema>;

/** A company asking for a specific post to be reviewed (F2.12). Companies arrive in S10. */
export const companyReviewRequestSchema = z
  .object({
    companyId: z.uuid().optional(),
    targetType: z.string().min(1),
    targetId: z.uuid(),
    message: z.string().trim().min(20).max(2000),
    contactEmail: z.email(),
  })
  .strict();

/** A held comment, snapshotted for the queue (S6). */
export const commentSnapshotSchema = z
  .object({
    subjectType: z.enum(["lesson", "course"]),
    subjectId: z.uuid(),
    courseSlug: z.string().min(1),
    subjectSlug: z.string().min(1),
    subjectTitle: z.string().min(1),
    kind: z.enum(["question", "note", "answer"]),
    body: z.string().min(1).max(5000),
    anchor: z.string().optional(),
    holdReason: z.string().min(1),
  })
  .strict();

/** A flagged course review, snapshotted for the queue (S6). */
export const courseReviewSnapshotSchema = z
  .object({
    courseSlug: z.string().min(1),
    courseTitle: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    title: z.string().optional(),
    body: z.string().min(1).max(2000),
  })
  .strict();

export type ModerationPayload = z.infer<typeof moderationPayloadSchema>;

/** `moderation_actions.before` / `after`: a shallow record of the fields an action changed. */
export const auditChangeSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
);
export type AuditChange = z.infer<typeof auditChangeSchema>;

/** What a certificate attests to, frozen at issue time (F1.18). */
export const certificateCriteriaSchema = z
  .object({
    criteria: completionCriteriaSchema,
    lessons: z.array(
      z.object({
        slug: z.string(),
        title: z.string(),
        type: z.string(),
        completedAt: z.string(),
      }),
    ),
    quizzes: z.array(
      z.object({
        lessonSlug: z.string(),
        title: z.string(),
        bestScore: z.number().int().min(0).max(100),
        passScore: z.number().int().min(0).max(100),
      }),
    ),
    projects: z.array(
      z.object({
        lessonSlug: z.string(),
        title: z.string(),
        repoUrl: z.string(),
      }),
    ),
    contentCommit: z.string().optional(),
    contentRepo: z.string().optional(),
  })
  .strict();
export type CertificateCriteria = z.infer<typeof certificateCriteriaSchema>;

/** Public profile links (X5). */
export const profileLinksSchema = z
  .object({
    github: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9-]{1,39}$/)
      .optional(),
    // http(s) only: these render as links on a public page, and z.url() alone
    // accepts javascript: and data: URLs.
    website: z.url({ protocol: /^https?$/ }).optional(),
    linkedin: z.url({ protocol: /^https?$/ }).optional(),
  })
  .strict();
export type ProfileLinks = z.infer<typeof profileLinksSchema>;

/** A certificate under review, snapshotted for the queue (S7). */
export const certificateSnapshotSchema = z
  .object({
    learnerName: z.string(),
    courseTitle: z.string(),
    courseSlug: z.string(),
    issuedAt: z.string(),
  })
  .strict();

/** `moderation_items.payload`, discriminated by the item's subject type. */
export const moderationPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mentor_application"),
    data: mentorApplicationSchema,
  }),
  z.object({
    kind: z.literal("company_review_request"),
    data: companyReviewRequestSchema,
  }),
  z.object({ kind: z.literal("comment"), data: commentSnapshotSchema }),
  z.object({
    kind: z.literal("course_review"),
    data: courseReviewSnapshotSchema,
  }),
  z.object({ kind: z.literal("certificate"), data: certificateSnapshotSchema }),
]);
