import { schema, type db } from "@repo/database";
import { progressEventPayloadSchema } from "@repo/database/schema";
import { z } from "zod";

export type Database = typeof db;
/** The transaction handle drizzle passes to `db.transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const progressEventKinds = schema.progressEventKind.enumValues;
export type ProgressEventKind = (typeof progressEventKinds)[number];

export const recordEventInput = z.object({
  userId: z.uuid(),
  kind: z.enum(progressEventKinds),
  courseId: z.uuid().optional(),
  lessonId: z.uuid().optional(),
  payload: progressEventPayloadSchema.optional(),
  /** `${kind}:${userId}:${subjectId}[:${clientNonce}]`. Duplicates are ignored, not errors. */
  idempotencyKey: z.string().min(1).max(512),
  occurredAt: z.date().optional(),
});
export type RecordEventInput = z.input<typeof recordEventInput>;

export type RecordEventResult = {
  duplicate: boolean;
  eventId?: string;
  /** True when this call caused the course to complete. */
  courseCompleted?: boolean;
};

export const lessonProgressedPayload = z.object({
  percent: z.number().int().min(0).max(100).optional(),
  positionSeconds: z.number().int().min(0).optional(),
});

export const courseEnrolledPayload = z.object({
  teamId: z.uuid().optional(),
});
