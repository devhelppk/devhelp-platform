import { checkContentAsync } from "@repo/content-schema/check";
import {
  loadContentTree,
  type ContentTree,
  type LoadedCourse,
} from "@repo/content-schema";
import { and, db, eq, isNull, notInArray, schema, sql } from "@repo/database";

export type SyncSummary = {
  sha: string;
  revisionId: string;
  courses: Counts;
  modules: Counts;
  lessons: Counts;
  quizzes: Counts;
  exercises: Counts;
  paths: Counts;
};
type Counts = {
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
};
const counts = (): Counts => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  archived: 0,
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Upsert content metadata into Postgres by slug. Idempotent: unchanged
 * hashes are skipped, missing items are archived (never deleted) so learner
 * progress keeps its foreign keys. Lesson bodies are not stored here.
 */
export async function syncContent(input: {
  dir: string;
  sha: string;
  repo: string;
  /** Explicitly allow a tree with no courses (archives everything this repo produced). */
  allowEmpty?: boolean;
}): Promise<SyncSummary> {
  const tree = loadContentTree(input.dir);
  // Schema + cross-file rules (refs, unique slugs, order prefixes) plus the
  // harness parity run, so a sync can never publish tests the browser runner
  // cannot execute. The vitest run against solutions stays content:check's job.
  const fatal = (await checkContentAsync(tree)).filter(
    (d) => d.level === "error",
  );
  if (fatal.length) {
    throw new Error(
      `content has ${fatal.length} error(s); run content:check first:\n` +
        fatal.map((d) => `  ${d.file} [${d.rule}] ${d.message}`).join("\n"),
    );
  }
  // An empty tree would archive the whole catalogue; that is never what a sync means.
  if (tree.courses.length === 0 && !input.allowEmpty) {
    throw new Error(
      `no courses found in ${input.dir}; refusing to sync (pass allowEmpty to archive everything on purpose)`,
    );
  }
  return db.transaction(async (tx) => {
    const [rev] = await tx
      .insert(schema.contentRevisions)
      .values({
        repo: input.repo,
        commitSha: input.sha,
        summary: `${tree.courses.length} course(s)`,
        itemCount: countItems(tree),
      })
      .onConflictDoUpdate({
        target: [
          schema.contentRevisions.repo,
          schema.contentRevisions.commitSha,
        ],
        set: { itemCount: countItems(tree) },
      })
      .returning();
    const revisionId = rev!.id;
    const summary: SyncSummary = {
      sha: input.sha,
      revisionId,
      courses: counts(),
      modules: counts(),
      lessons: counts(),
      quizzes: counts(),
      exercises: counts(),
      paths: counts(),
    };

    const courseIdBySlug = new Map<string, string>();
    for (const course of tree.courses) {
      const id = await syncCourse(tx, course, revisionId, summary);
      courseIdBySlug.set(course.meta.slug, id);
    }
    // Prerequisites need every course id first.
    for (const course of tree.courses) {
      const courseId = courseIdBySlug.get(course.meta.slug)!;
      await tx
        .delete(schema.coursePrerequisites)
        .where(eq(schema.coursePrerequisites.courseId, courseId));
      if (course.meta.prerequisites.length) {
        await tx.insert(schema.coursePrerequisites).values(
          course.meta.prerequisites.map((p) => ({
            courseId,
            prerequisiteId: courseIdBySlug.get(p)!,
          })),
        );
      }
    }
    // Courses that vanished from content are archived (progress rows survive).
    const live = [...courseIdBySlug.values()];
    // Only rows this repo produced are candidates: a sync from another source
    // (tests, a second content repo) must never archive this repo's content.
    const ownedBy = (revisionCol: unknown) =>
      sql`${revisionCol} in (select id from ${schema.contentRevisions} where ${schema.contentRevisions.repo} = ${input.repo})`;
    const archivedCourses = await tx
      .update(schema.courses)
      .set({ archivedAt: new Date(), isPublished: false })
      .where(
        and(
          isNull(schema.courses.archivedAt),
          live.length ? notInArray(schema.courses.id, live) : sql`true`,
          ownedBy(schema.courses.contentRevisionId),
        ),
      )
      .returning({ id: schema.courses.id });
    summary.courses.archived += archivedCourses.length;

    await syncPaths(
      tx,
      tree,
      courseIdBySlug,
      summary,
      revisionId,
      ownedBy(schema.paths.contentRevisionId),
    );
    return summary;
  });
}

function countItems(tree: ContentTree): number {
  return (
    tree.courses.reduce(
      (n, c) =>
        n +
        1 +
        c.modules.length +
        c.modules.reduce((m, x) => m + x.lessons.length, 0) +
        c.quizzes.length +
        c.exercises.length,
      0,
    ) + tree.paths.length
  );
}

async function syncCourse(
  tx: Tx,
  course: LoadedCourse,
  revisionId: string,
  summary: SyncSummary,
): Promise<string> {
  const m = course.meta;
  const existing = await tx.query.courses.findFirst({
    where: eq(schema.courses.slug, m.slug),
    columns: {
      id: true,
      contentHash: true,
      contentPath: true,
      archivedAt: true,
      isPublished: true,
    },
  });
  const values = {
    slug: m.slug,
    title: m.title,
    summary: m.summary,
    description: m.description ?? null,
    track: m.track,
    level: m.level,
    coverImageUrl: m.cover ?? null,
    estimatedHours: m.estimatedHours ?? null,
    isPublished: m.published,
    completionCriteria: m.completionCriteria,
    contentPath: course.dir,
    contentHash: course.hash,
    contentRevisionId: revisionId,
    archivedAt: null,
  };
  let courseId: string;
  if (!existing) {
    const [row] = await tx
      .insert(schema.courses)
      .values({ ...values, publishedAt: m.published ? new Date() : null })
      .returning({ id: schema.courses.id });
    courseId = row!.id;
    summary.courses.created++;
  } else if (
    existing.contentHash === course.hash &&
    existing.archivedAt === null &&
    existing.isPublished === m.published &&
    existing.contentPath === course.dir
  ) {
    // Unchanged rows are left alone (updated_at and content_revision_id stay honest);
    // "what is deployed" is the latest content_revisions row.
    courseId = existing.id;
    summary.courses.unchanged++;
  } else {
    courseId = existing.id;
    await tx
      .update(schema.courses)
      .set({
        ...values,
        publishedAt: sql`case when ${schema.courses.publishedAt} is null and ${m.published} then now() else ${schema.courses.publishedAt} end`,
      })
      .where(eq(schema.courses.id, courseId));
    summary.courses.updated++;
  }

  // Modules
  const moduleIdBySlug = new Map<string, string>();
  for (const mod of course.modules) {
    const values = {
      courseId,
      slug: mod.meta.slug,
      title: mod.meta.title,
      summary: mod.meta.summary ?? null,
      position: mod.order,
      archivedAt: null,
    };
    const prev = await tx.query.modules.findFirst({
      where: and(
        eq(schema.modules.courseId, courseId),
        eq(schema.modules.slug, mod.meta.slug),
      ),
    });
    if (!prev) {
      const [row] = await tx
        .insert(schema.modules)
        .values(values)
        .returning({ id: schema.modules.id });
      moduleIdBySlug.set(mod.meta.slug, row!.id);
      summary.modules.created++;
    } else {
      moduleIdBySlug.set(mod.meta.slug, prev.id);
      const same =
        prev.title === values.title &&
        prev.summary === values.summary &&
        prev.position === values.position &&
        prev.archivedAt === null;
      if (same) summary.modules.unchanged++;
      else {
        await tx
          .update(schema.modules)
          .set(values)
          .where(eq(schema.modules.id, prev.id));
        summary.modules.updated++;
      }
    }
  }
  const liveModules = [...moduleIdBySlug.values()];
  const archivedModules = await tx
    .update(schema.modules)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(schema.modules.courseId, courseId),
        isNull(schema.modules.archivedAt),
        liveModules.length
          ? notInArray(schema.modules.id, liveModules)
          : sql`true`,
      ),
    )
    .returning({ id: schema.modules.id });
  summary.modules.archived += archivedModules.length;

  // Lessons
  const liveLessons: string[] = [];
  const lessonIdBySlug = new Map<string, string>();
  for (const mod of course.modules) {
    const moduleId = moduleIdBySlug.get(mod.meta.slug)!;
    for (const lesson of mod.lessons) {
      const fm = lesson.meta;
      const values = {
        moduleId,
        courseId,
        slug: fm.slug,
        title: fm.title,
        type: fm.type,
        completionRule: fm.completionRule,
        mode: fm.mode,
        isRequired: fm.isRequired,
        isFree: fm.isFree,
        durationMinutes: fm.durationMinutes ?? null,
        position: mod.order * 1000 + lesson.order,
        videoProvider: fm.type === "video" ? fm.video.provider : null,
        videoId: fm.type === "video" ? fm.video.id : null,
        contentPath: lesson.file,
        contentHash: lesson.hash,
        contentRevisionId: revisionId,
        archivedAt: null,
      };
      const prev = await tx.query.lessons.findFirst({
        where: and(
          eq(schema.lessons.courseId, courseId),
          eq(schema.lessons.slug, fm.slug),
        ),
        columns: {
          id: true,
          contentHash: true,
          moduleId: true,
          archivedAt: true,
          position: true,
          contentPath: true,
        },
      });
      let lessonId: string;
      if (!prev) {
        const [row] = await tx
          .insert(schema.lessons)
          .values(values)
          .returning({ id: schema.lessons.id });
        lessonId = row!.id;
        summary.lessons.created++;
      } else {
        lessonId = prev.id;
        if (
          prev.contentHash === lesson.hash &&
          prev.moduleId === moduleId &&
          prev.archivedAt === null &&
          prev.position === values.position &&
          prev.contentPath === values.contentPath
        ) {
          summary.lessons.unchanged++;
        } else {
          await tx
            .update(schema.lessons)
            .set(values)
            .where(eq(schema.lessons.id, lessonId));
          summary.lessons.updated++;
        }
      }
      liveLessons.push(lessonId);
      lessonIdBySlug.set(fm.slug, lessonId);
    }
  }
  const archivedLessons = await tx
    .update(schema.lessons)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(schema.lessons.courseId, courseId),
        isNull(schema.lessons.archivedAt),
        liveLessons.length
          ? notInArray(schema.lessons.id, liveLessons)
          : sql`true`,
      ),
    )
    .returning({ id: schema.lessons.id });
  summary.lessons.archived += archivedLessons.length;

  // Quizzes: attached to the lesson that references them; questions replaced atomically on change.
  const quizLessons = new Map(
    course.modules.flatMap((mod) =>
      mod.lessons
        .filter((l) => l.meta.type === "quiz")
        .map(
          (l) =>
            [
              l.meta.type === "quiz" ? l.meta.quiz : "",
              lessonIdBySlug.get(l.meta.slug)!,
            ] as const,
        ),
    ),
  );
  for (const quiz of course.quizzes) {
    const lessonId = quizLessons.get(quiz.data.id);
    if (!lessonId) continue; // unreferenced quiz: checker warns, sync ignores
    const prev = await tx.query.quizzes.findFirst({
      where: eq(schema.quizzes.lessonId, lessonId),
    });
    if (prev && prev.contentHash === quiz.hash) {
      summary.quizzes.unchanged++;
      continue;
    }
    const version = prev ? prev.version + 1 : 1;
    const [row] = await tx
      .insert(schema.quizzes)
      .values({
        lessonId,
        passScore: quiz.data.passScore,
        maxAttempts: quiz.data.maxAttempts ?? null,
        shuffle: quiz.data.shuffle,
        version,
        contentHash: quiz.hash,
      })
      .onConflictDoUpdate({
        target: schema.quizzes.lessonId,
        set: {
          passScore: quiz.data.passScore,
          maxAttempts: quiz.data.maxAttempts ?? null,
          shuffle: quiz.data.shuffle,
          version,
          contentHash: quiz.hash,
        },
      })
      .returning({ id: schema.quizzes.id });
    await tx
      .delete(schema.questions)
      .where(eq(schema.questions.quizId, row!.id));
    await tx.insert(schema.questions).values(
      quiz.data.questions.map((q, i) => ({
        quizId: row!.id,
        position: i,
        type: q.type,
        prompt: q.prompt,
        options:
          q.type === "short"
            ? []
            : q.options.map((o) => ({
                id: o.id,
                text: o.text,
                isCorrect: o.correct,
                feedback: o.feedback,
              })),
        answer: q.type === "short" ? q.answer : null,
        explanation: q.explanation ?? null,
        points: q.points,
        version,
      })),
    );
    if (prev) summary.quizzes.updated++;
    else summary.quizzes.created++;
  }

  // Exercises
  const exerciseLessons = new Map(
    course.modules.flatMap((mod) =>
      mod.lessons
        .filter((l) => l.meta.type === "exercise")
        .map(
          (l) =>
            [
              l.meta.type === "exercise" ? l.meta.exercise : "",
              lessonIdBySlug.get(l.meta.slug)!,
            ] as const,
        ),
    ),
  );
  for (const ex of course.exercises) {
    const lessonId = exerciseLessons.get(ex.meta.id);
    if (!lessonId) continue;
    const prev = await tx.query.exercises.findFirst({
      where: eq(schema.exercises.lessonId, lessonId),
    });
    if (prev && prev.contentHash === ex.hash) {
      summary.exercises.unchanged++;
      continue;
    }
    const values = {
      lessonId,
      runner: ex.meta.runner,
      language: ex.meta.language,
      starterFiles: ex.starterFiles,
      testFiles: ex.testFiles,
      instructions: ex.instructions || null,
      version: prev ? prev.version + 1 : 1,
      contentHash: ex.hash,
    };
    await tx
      .insert(schema.exercises)
      .values(values)
      .onConflictDoUpdate({ target: schema.exercises.lessonId, set: values });
    if (prev) summary.exercises.updated++;
    else summary.exercises.created++;
  }

  return courseId;
}

async function syncPaths(
  tx: Tx,
  tree: ContentTree,
  courseIdBySlug: Map<string, string>,
  summary: SyncSummary,
  revisionId: string,
  ownedByRepo: ReturnType<typeof sql>,
) {
  const live: string[] = [];
  for (const path of tree.paths) {
    const d = path.data;
    const values = {
      slug: d.slug,
      title: d.title,
      summary: d.summary,
      description: d.description ?? null,
      isPublished: d.published,
      position: d.position,
      contentRevisionId: revisionId,
      archivedAt: null,
    };
    const prev = await tx.query.paths.findFirst({
      where: eq(schema.paths.slug, d.slug),
    });
    let pathId: string;
    if (!prev) {
      const [row] = await tx
        .insert(schema.paths)
        .values(values)
        .returning({ id: schema.paths.id });
      pathId = row!.id;
      summary.paths.created++;
    } else {
      pathId = prev.id;
      const prevCourses = await tx.query.pathCourses.findMany({
        where: eq(schema.pathCourses.pathId, pathId),
        orderBy: (pc, { asc }) => [asc(pc.position)],
      });
      const sameCourses =
        prevCourses.length === d.courses.length &&
        prevCourses.every(
          (pc, i) => pc.courseId === courseIdBySlug.get(d.courses[i]!),
        );
      const sameMeta =
        prev.title === values.title &&
        prev.summary === values.summary &&
        prev.description === values.description &&
        prev.isPublished === values.isPublished &&
        prev.position === values.position &&
        prev.archivedAt === null;
      if (sameCourses && sameMeta) {
        summary.paths.unchanged++;
        live.push(pathId);
        continue;
      }
      await tx
        .update(schema.paths)
        .set(values)
        .where(eq(schema.paths.id, pathId));
      summary.paths.updated++;
    }
    live.push(pathId);
    await tx
      .delete(schema.pathCourses)
      .where(eq(schema.pathCourses.pathId, pathId));
    await tx.insert(schema.pathCourses).values(
      d.courses.map((slug, i) => ({
        pathId,
        courseId: courseIdBySlug.get(slug)!,
        position: i,
      })),
    );
  }
  const archived = await tx
    .update(schema.paths)
    .set({ archivedAt: new Date(), isPublished: false })
    .where(
      and(
        isNull(schema.paths.archivedAt),
        live.length ? notInArray(schema.paths.id, live) : sql`true`,
        ownedByRepo,
      ),
    )
    .returning({ id: schema.paths.id });
  summary.paths.archived += archived.length;
}
