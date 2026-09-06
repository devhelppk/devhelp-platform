import { and, db, eq, isNull, schema } from "@repo/database";
import { generationAt, issueCertificate } from "../src/certificates";

/**
 * Issues certificates for enrolments completed before S7. Idempotent: a
 * learner who already holds one for the course is skipped. Run once on
 * deploy: `pnpm certificates:backfill`.
 */
const completed = await db
  .select({
    userId: schema.enrollments.userId,
    courseId: schema.enrollments.courseId,
    completedAt: schema.enrollments.completedAt,
  })
  .from(schema.enrollments)
  .leftJoin(
    schema.certificates,
    and(
      eq(schema.certificates.userId, schema.enrollments.userId),
      eq(schema.certificates.courseId, schema.enrollments.courseId),
    ),
  )
  .where(
    and(
      eq(schema.enrollments.status, "completed"),
      isNull(schema.certificates.id),
    ),
  );
let issued = 0;
for (const e of completed) {
  await db.transaction(async (tx) => {
    const r = await issueCertificate(tx, {
      userId: e.userId,
      courseId: e.courseId,
      issuedAt: e.completedAt ?? new Date(),
      enrolmentGeneration: await generationAt(tx, e.userId, e.courseId),
    });
    if (r.created) issued++;
  });
}
console.log(
  `certificates: ${issued} issued for ${completed.length} completed enrolment(s) without one`,
);
process.exit(0);
