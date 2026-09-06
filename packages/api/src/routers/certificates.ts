import { and, desc, eq, ilike, lt, or, schema } from "@repo/database";
import { getStorage } from "@repo/storage";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../trpc";

const certColumns = {
  id: true,
  courseId: true,
  learnerName: true,
  courseTitle: true,
  criteria: true,
  issuedAt: true,
  revokedAt: true,
  revokedReason: true,
  enrolmentGeneration: true,
} as const;

/** Certificates (S7): public verify data, the learner's own list, admin revocation with audit and notice. */
export const certificatesRouter = router({
  /** Everything the public verify page shows. Unknown id → NOT_FOUND. */
  byId: publicProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const c = await ctx.db.query.certificates.findFirst({
        where: eq(schema.certificates.id, input.id),
        columns: certColumns,
        with: {
          course: { columns: { slug: true, title: true, track: true } },
          contentRevision: { columns: { commitSha: true, repo: true } },
        },
      });
      if (!c)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Certificate not found.",
        });
      return c;
    }),

  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.certificates.findMany({
      where: eq(schema.certificates.userId, ctx.user.id),
      orderBy: [desc(schema.certificates.issuedAt)],
      columns: certColumns,
      with: { course: { columns: { slug: true } } },
    }),
  ),

  adminList: adminProcedure
    .input(
      z
        .object({
          q: z.string().trim().max(80).optional(),
          cursor: z.date().optional(),
          limit: z.number().int().min(1).max(100).default(30),
        })
        .default({ limit: 30 }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.q ? `%${input.q}%` : null;
      const rows = await ctx.db.query.certificates.findMany({
        where: and(
          q
            ? or(
                ilike(schema.certificates.learnerName, q),
                ilike(schema.certificates.courseTitle, q),
              )
            : undefined,
          input.cursor
            ? lt(schema.certificates.issuedAt, input.cursor)
            : undefined,
        ),
        orderBy: [desc(schema.certificates.issuedAt)],
        limit: input.limit + 1,
        columns: { ...certColumns, userId: true },
        with: {
          user: { columns: { email: true } },
          course: { columns: { slug: true } },
        },
      });
      const page = rows.slice(0, input.limit);
      return {
        items: page,
        nextCursor:
          rows.length > input.limit
            ? page[page.length - 1]?.issuedAt
            : undefined,
      };
    }),

  /** Revoke with a reason: state on the row, an audit item + action, the cached PDF dropped, the learner told. */
  revoke: adminProcedure
    .input(
      z.object({ id: z.uuid(), reason: z.string().trim().min(5).max(500) }),
    )
    .mutation(async ({ ctx, input }) => {
      const cert = await ctx.db.transaction(async (tx) => {
        const [c] = await tx
          .select()
          .from(schema.certificates)
          .where(eq(schema.certificates.id, input.id))
          .for("update");
        if (!c)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Certificate not found.",
          });
        if (c.revokedAt)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Already revoked.",
          });
        const now = new Date();
        await tx
          .update(schema.certificates)
          .set({
            revokedAt: now,
            revokedReason: input.reason,
            revokedBy: ctx.user.id,
            pdfKey: null,
          })
          .where(eq(schema.certificates.id, c.id));
        const course = await tx.query.courses.findFirst({
          where: eq(schema.courses.id, c.courseId),
          columns: { slug: true, track: true },
        });
        const [item] = await tx
          .insert(schema.moderationItems)
          .values({
            subjectType: "certificate",
            subjectId: c.id,
            status: "hidden",
            track: course?.track ?? null,
            submittedBy: c.userId,
            decidedBy: ctx.user.id,
            decidedAt: now,
            reason: input.reason,
            payload: {
              kind: "certificate",
              data: {
                learnerName: c.learnerName,
                courseTitle: c.courseTitle,
                courseSlug: course?.slug ?? "",
                issuedAt: c.issuedAt.toISOString(),
              },
            },
          })
          .onConflictDoUpdate({
            target: [
              schema.moderationItems.subjectType,
              schema.moderationItems.subjectId,
            ],
            set: {
              status: "hidden",
              decidedBy: ctx.user.id,
              decidedAt: now,
              reason: input.reason,
              updatedAt: now,
            },
          })
          .returning({ id: schema.moderationItems.id });
        await tx.insert(schema.moderationActions).values({
          itemId: item!.id,
          actorId: ctx.user.id,
          action: "hide",
          reason: input.reason,
          before: { revoked: false },
          after: { revoked: true },
        });
        return { ...c, pdfKey: c.pdfKey };
      });
      if (cert.pdfKey)
        await getStorage()
          .delete(cert.pdfKey)
          .catch((e) => console.error("[certificates] pdf delete failed:", e));
      try {
        const [{ notify }, { sendEmailTemplate }] = await Promise.all([
          import("@repo/notify"),
          import("@repo/learning/certificate-email"),
        ]);
        const user = await ctx.db.query.users.findFirst({
          where: eq(schema.users.id, cert.userId),
          columns: { email: true, name: true },
        });
        if (user)
          await notify({
            userId: cert.userId,
            kind: "certificate_revoked",
            title: `Certificate revoked: ${cert.courseTitle}`,
            body: input.reason,
            href: `/verify/${cert.id}`,
            subjectType: "certificate",
            subjectId: cert.id,
            dedupeKey: `certificate-revoked:${cert.id}:${Date.now()}`,
            email: await sendEmailTemplate("revoked", {
              to: user.email,
              name: user.name,
              courseTitle: cert.courseTitle,
              certificateId: cert.id,
              reason: input.reason,
            }),
          });
      } catch (e) {
        console.error("[certificates] revoke notification failed:", e);
      }
      return { id: cert.id };
    }),

  restore: adminProcedure
    .input(
      z.object({ id: z.uuid(), reason: z.string().trim().min(5).max(500) }),
    )
    .mutation(async ({ ctx, input }) => {
      const pdfKey = await ctx.db.transaction(async (tx) => {
        const [c] = await tx
          .select()
          .from(schema.certificates)
          .where(eq(schema.certificates.id, input.id))
          .for("update");
        if (!c?.revokedAt)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Not revoked.",
          });
        const now = new Date();
        await tx
          .update(schema.certificates)
          .set({
            revokedAt: null,
            revokedReason: null,
            revokedBy: null,
            pdfKey: null,
          })
          .where(eq(schema.certificates.id, c.id));
        const item = await tx.query.moderationItems.findFirst({
          where: and(
            eq(schema.moderationItems.subjectType, "certificate"),
            eq(schema.moderationItems.subjectId, c.id),
          ),
          columns: { id: true },
        });
        if (item) {
          await tx
            .update(schema.moderationItems)
            .set({
              status: "approved",
              decidedBy: ctx.user.id,
              decidedAt: now,
              reason: input.reason,
              updatedAt: now,
            })
            .where(eq(schema.moderationItems.id, item.id));
          await tx.insert(schema.moderationActions).values({
            itemId: item.id,
            actorId: ctx.user.id,
            action: "unhide",
            reason: input.reason,
            before: { revoked: true },
            after: { revoked: false },
          });
        }
        return c.pdfKey;
      });
      if (pdfKey)
        await getStorage()
          .delete(pdfKey)
          .catch(() => {});
      return { ok: true };
    }),
});
