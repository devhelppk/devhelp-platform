import { db, eq, schema, sql } from "./index";
import { questionOptionsSchema } from "./schema/json";

/**
 * Idempotent seed: upserts by slug so it can run on every `pnpm db:seed`.
 * Learner progress is never touched here; it belongs to @repo/learning.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production.");
  }

  await db
    .insert(schema.contentRevisions)
    .values({
      repo: "seed",
      commitSha: "seed",
      summary: "Local seed content",
      itemCount: 0,
    })
    .onConflictDoNothing();
  const revision = await db.query.contentRevisions.findFirst({
    where: eq(schema.contentRevisions.commitSha, "seed"),
  });
  const contentRevisionId = revision!.id;

  // Never touch an existing account: a re-run must not escalate anyone's role.
  await db
    .insert(schema.users)
    .values({
      email: "team@devhelp.pk",
      name: "devhelp team",
      role: "admin",
      city: "Karachi",
    })
    .onConflictDoNothing();
  const author = await db.query.users.findFirst({
    where: eq(schema.users.email, "team@devhelp.pk"),
  });

  const seededCourseIds: string[] = [];
  async function upsertCourse(
    input: Omit<schema.NewCourse, "authorId" | "contentRevisionId">,
  ) {
    const [course] = await db
      .insert(schema.courses)
      .values({ ...input, authorId: author!.id, contentRevisionId })
      .onConflictDoUpdate({
        target: schema.courses.slug,
        set: {
          ...input,
          contentRevisionId,
          archivedAt: null,
          // Keep the original publish date; only fill it when missing.
          publishedAt: sql`coalesce(${schema.courses.publishedAt}, now())`,
        },
      })
      .returning();
    seededCourseIds.push(course!.id);
    return course!;
  }

  async function upsertModule(
    courseId: string,
    slug: string,
    title: string,
    position: number,
  ) {
    const [mod] = await db
      .insert(schema.modules)
      .values({ courseId, slug, title, position })
      .onConflictDoUpdate({
        target: [schema.modules.courseId, schema.modules.slug],
        set: { title, position, archivedAt: null },
      })
      .returning();
    return mod!;
  }

  const seededLessonIds: string[] = [];
  async function upsertLesson(
    input: Omit<schema.NewLesson, "contentRevisionId">,
  ) {
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ...input, contentRevisionId })
      .onConflictDoUpdate({
        target: [schema.lessons.courseId, schema.lessons.slug],
        set: { ...input, contentRevisionId, archivedAt: null },
      })
      .returning();
    seededLessonIds.push(lesson!.id);
    return lesson!;
  }

  // Course 1: technical track.
  const ai = await upsertCourse({
    slug: "ai-engineering-foundations",
    title: "AI Engineering Foundations",
    summary:
      "How software engineering actually works in 2026: coding with agents, evals, and shipping reliably.",
    track: "technical",
    level: "beginner",
    estimatedHours: 12,
    isPublished: true,
    publishedAt: new Date(),
    contentPath: "courses/ai-engineering-foundations",
  });
  const aiIntro = await upsertModule(
    ai.id,
    "getting-started",
    "Getting started",
    0,
  );

  await upsertLesson({
    moduleId: aiIntro.id,
    courseId: ai.id,
    slug: "welcome",
    title: "Welcome to devhelp",
    type: "article",
    completionRule: "view",
    durationMinutes: 5,
    position: 0,
    contentPath:
      "courses/ai-engineering-foundations/getting-started/welcome.mdx",
  });
  await upsertLesson({
    moduleId: aiIntro.id,
    courseId: ai.id,
    slug: "how-agents-work",
    title: "How coding agents actually work",
    type: "video",
    completionRule: "view",
    mode: "industry",
    durationMinutes: 18,
    position: 1,
    videoProvider: "youtube",
    videoId: "dQw4w9WgXcQ",
    contentPath:
      "courses/ai-engineering-foundations/getting-started/how-agents-work.mdx",
  });
  const check = await upsertLesson({
    moduleId: aiIntro.id,
    courseId: ai.id,
    slug: "foundations-check",
    title: "Foundations check",
    type: "quiz",
    completionRule: "quiz_pass",
    durationMinutes: 10,
    position: 2,
    contentPath:
      "courses/ai-engineering-foundations/getting-started/foundations-check.mdx",
  });

  const questionRows: Omit<typeof schema.questions.$inferInsert, "quizId">[] = [
    {
      position: 0,
      type: "single",
      prompt: "What should you do before accepting code an agent wrote?",
      options: [
        {
          id: "a",
          text: "Ship it; the agent tested it",
          isCorrect: false,
          feedback:
            "The agent's tests prove what the agent thought, not what you need.",
        },
        {
          id: "b",
          text: "Read it, run it, and trace the data through it",
          isCorrect: true,
          feedback: "You own correctness.",
        },
        {
          id: "c",
          text: "Ask another agent to review it",
          isCorrect: false,
          feedback: "Useful, but it does not replace your own trace.",
        },
      ],
      explanation:
        "Industry mode means AI is allowed and you are accountable for the result.",
    },
    {
      position: 1,
      type: "single",
      prompt:
        "A customer is occasionally charged twice. Which trace do you start with?",
      options: [
        {
          id: "a",
          text: "The payment request's path from click to database write",
          isCorrect: true,
        },
        { id: "b", text: "The CSS of the checkout button", isCorrect: false },
        { id: "c", text: "The company's pricing page", isCorrect: false },
      ],
    },
  ];
  await db.transaction(async (tx) => {
    const [quiz] = await tx
      .insert(schema.quizzes)
      .values({ lessonId: check.id, passScore: 70 })
      .onConflictDoUpdate({
        target: schema.quizzes.lessonId,
        set: { passScore: 70 },
      })
      .returning();
    await tx
      .delete(schema.questions)
      .where(eq(schema.questions.quizId, quiz!.id));
    await tx.insert(schema.questions).values(
      questionRows.map((q) => ({
        ...q,
        quizId: quiz!.id,
        options: questionOptionsSchema.parse(q.options),
      })),
    );
  });

  // Course 2: career track, so the catalogue has both tracks.
  const comms = await upsertCourse({
    slug: "communication-for-engineers",
    title: "Communication for engineers",
    summary:
      "Write updates, ask questions, and disagree well in async, remote, English-first teams.",
    track: "career",
    level: "beginner",
    estimatedHours: 4,
    isPublished: true,
    publishedAt: new Date(),
    contentPath: "courses/communication-for-engineers",
  });
  const commsIntro = await upsertModule(
    comms.id,
    "writing",
    "Writing at work",
    0,
  );
  await upsertLesson({
    moduleId: commsIntro.id,
    courseId: comms.id,
    slug: "the-daily-update",
    title: "The daily update that gets read",
    type: "article",
    completionRule: "view",
    durationMinutes: 8,
    position: 0,
    contentPath:
      "courses/communication-for-engineers/writing/the-daily-update.mdx",
  });

  const [path] = await db
    .insert(schema.paths)
    .values({
      slug: "ai-engineering",
      title: "AI Engineering",
      summary: "From fundamentals to shipping with agents, in order.",
      isPublished: true,
    })
    .onConflictDoUpdate({
      target: schema.paths.slug,
      set: { isPublished: true },
    })
    .returning();
  await db
    .insert(schema.pathCourses)
    .values([
      { pathId: path!.id, courseId: ai.id, position: 0 },
      { pathId: path!.id, courseId: comms.id, position: 1 },
    ])
    .onConflictDoNothing();

  // Anything in a seeded course that this seed no longer emits is archived, never deleted.
  const archived = await db
    .update(schema.lessons)
    .set({ archivedAt: new Date() })
    .where(
      sql`${schema.lessons.courseId} in ${seededCourseIds} and ${schema.lessons.id} not in ${seededLessonIds} and ${schema.lessons.archivedAt} is null`,
    )
    .returning({ id: schema.lessons.id });

  console.log(
    `Seeded 1 path, 2 courses, ${seededLessonIds.length} lessons, 1 quiz` +
      (archived.length
        ? `; archived ${archived.length} stale lesson(s).`
        : "."),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
