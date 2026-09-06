import { and, db, eq, inArray, schema } from "@repo/database";

const run = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export async function createUser(label = "learner") {
  const id = run();
  const [user] = await db
    .insert(schema.users)
    .values({ email: `${label}-${id}@devhelp.test`, name: `${label} ${id}` })
    .returning();
  return user!;
}

/** A course with N required lessons (+ optional extra non-required lesson). */
export async function createCourse(opts: {
  required: number;
  optional?: number;
  criteria?: schema.CompletionCriteria;
}) {
  const id = run();
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug: `course-${id}`,
      title: `Course ${id}`,
      summary: "test",
      isPublished: true,
      ...(opts.criteria ? { completionCriteria: opts.criteria } : {}),
    })
    .returning();
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId: course!.id, slug: "m1", title: "Module 1" })
    .returning();
  const values = [
    ...Array.from({ length: opts.required }, (_, i) => ({
      moduleId: mod!.id,
      courseId: course!.id,
      slug: `req-${i}`,
      title: `Required ${i}`,
      position: i,
      isRequired: true,
    })),
    ...Array.from({ length: opts.optional ?? 0 }, (_, i) => ({
      moduleId: mod!.id,
      courseId: course!.id,
      slug: `opt-${i}`,
      title: `Optional ${i}`,
      position: 100 + i,
      isRequired: false,
    })),
  ];
  const lessons = await db.insert(schema.lessons).values(values).returning();
  return {
    course: course!,
    required: lessons.filter((l) => l.isRequired),
    optional: lessons.filter((l) => !l.isRequired),
  };
}

export async function cleanup(userIds: string[], courseIds: string[]) {
  if (userIds.length)
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
  if (courseIds.length)
    await db
      .delete(schema.courses)
      .where(inArray(schema.courses.id, courseIds));
}

/** Read-model snapshot for byte-for-byte comparison (updatedAt excluded). */
export async function snapshot(userId: string) {
  const enrollments = await db.query.enrollments.findMany({
    where: eq(schema.enrollments.userId, userId),
    orderBy: (e, { asc }) => [asc(e.courseId)],
  });
  const progress = await db.query.lessonProgress.findMany({
    where: eq(schema.lessonProgress.userId, userId),
    orderBy: (p, { asc }) => [asc(p.lessonId)],
  });
  const strip = <T extends { updatedAt: Date }>(rows: T[]) =>
    rows.map((row) => {
      const { updatedAt, ...rest } = row;
      void updatedAt;
      return rest;
    });
  return {
    enrollments: strip(enrollments),
    progress: strip(progress),
    updatedAts: [...enrollments, ...progress].map((r) => r.updatedAt.getTime()),
  };
}

export async function events(userId: string, kind?: schema.ProgressEventKind) {
  return db.query.progressEvents.findMany({
    where: kind
      ? and(
          eq(schema.progressEvents.userId, userId),
          eq(schema.progressEvents.kind, kind),
        )
      : eq(schema.progressEvents.userId, userId),
  });
}
