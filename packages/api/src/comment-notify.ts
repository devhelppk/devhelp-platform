import { eq, schema } from "@repo/database";
import { notify } from "@repo/notify";

type Db = typeof import("@repo/database").db;

/**
 * Tell the people a newly visible comment concerns: the question's author for
 * a reply, lesson watchers for a question. Called after the commit that made
 * the comment visible (on create, or when a moderator approves a held one),
 * so held-then-approved comments are announced too. Best effort.
 */
export async function announceComment(db: Db, commentId: string) {
  try {
    const c = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
      with: { author: { columns: { name: true } } },
    });
    if (!c || c.status !== "visible") return;
    const course = await db.query.courses.findFirst({
      where: eq(schema.courses.id, c.courseId),
      columns: { slug: true, title: true },
    });
    const lesson =
      c.subjectType === "lesson"
        ? await db.query.lessons.findFirst({
            where: eq(schema.lessons.id, c.subjectId),
            columns: { slug: true, title: true },
          })
        : null;
    if (!course) return;
    const title = lesson?.title ?? course.title;
    const href = lesson
      ? `/courses/${course.slug}/${lesson.slug}#discussion`
      : `/courses/${course.slug}#discussion`;
    if (c.parentId) {
      const parent = await db.query.comments.findFirst({
        where: eq(schema.comments.id, c.parentId),
        columns: { authorId: true, kind: true },
      });
      if (parent?.authorId && parent.authorId !== c.authorId)
        await notify({
          userId: parent.authorId,
          kind: "comment_reply",
          title: `${c.author?.name ?? "Someone"} replied to your ${parent.kind === "note" ? "note" : "question"}`,
          body: `On ${title}`,
          href,
          subjectType: "comment",
          subjectId: c.id,
          dedupeKey: `reply:${c.id}`,
        });
      return;
    }
    if (c.subjectType === "lesson" && c.kind === "question") {
      const watchers = await db.query.lessonWatchers.findMany({
        where: eq(schema.lessonWatchers.lessonId, c.subjectId),
        columns: { userId: true },
      });
      for (const w of watchers)
        if (w.userId !== c.authorId)
          await notify({
            userId: w.userId,
            kind: "lesson_question",
            title: `New question on ${title}`,
            body: c.body.slice(0, 140),
            href,
            subjectType: "comment",
            subjectId: c.id,
            dedupeKey: `question:${c.id}:${w.userId}`,
          });
    }
  } catch (e) {
    console.error("[comments] announce failed:", e);
  }
}
