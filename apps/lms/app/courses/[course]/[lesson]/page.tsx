import { and, db, eq, schema } from "@repo/database";
import { Badge } from "@repo/ui/components/badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXContent } from "@/components/mdx/mdx-content";
import { allLessons, getCompiledLesson } from "@/lib/content";

/**
 * S2 proof route: the lesson body renders from compiled MDX with prose styles.
 * The real lesson experience (progress, Continue, sidebar) is S3.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return allLessons.map((l) => ({ course: l.courseDir, lesson: l.slug }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const course = await db.query.courses.findFirst({
    where: and(
      eq(schema.courses.slug, courseSlug),
      eq(schema.courses.isPublished, true),
    ),
    columns: { id: true, slug: true, title: true },
  });
  if (!course) notFound();
  const lesson = await db.query.lessons.findFirst({
    where: and(
      eq(schema.lessons.courseId, course.id),
      eq(schema.lessons.slug, lessonSlug),
    ),
  });
  if (!lesson || lesson.archivedAt) notFound();
  const compiled = lesson.contentPath
    ? getCompiledLesson(lesson.contentPath)
    : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/courses">Courses</Link> / {course.title}
      </p>
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {lesson.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{lesson.type}</Badge>
          <Badge variant="outline">
            {lesson.mode === "industry"
              ? "Industry mode: AI allowed"
              : "Foundation mode: no AI"}
          </Badge>
          {lesson.durationMinutes ? (
            <Badge variant="outline">{lesson.durationMinutes} min</Badge>
          ) : null}
        </div>
      </header>
      {lesson.type === "video" && lesson.videoId ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${lesson.videoId}`}
            title={lesson.title}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
      {compiled ? (
        <MDXContent code={compiled.body} />
      ) : (
        <p className="text-muted-foreground">
          This lesson&apos;s body is not in the current build. Run{" "}
          <code className="font-mono text-sm">pnpm content:refresh</code> and
          rebuild.
        </p>
      )}
    </main>
  );
}
