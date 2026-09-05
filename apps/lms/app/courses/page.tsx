import { db, eq, schema } from "@repo/database";
import { Button } from "@repo/ui/components/button";
import Link from "next/link";

// Reads from Postgres on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await db.query.courses.findMany({
    where: eq(schema.courses.isPublished, true),
    with: { modules: { with: { lessons: true } } },
    orderBy: (c, { asc }) => [asc(c.title)],
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Courses</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Dashboard</Link>
        </Button>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">
          No published courses yet. Run{" "}
          <code className="font-mono text-sm">pnpm db:seed</code>.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => {
            const lessonCount = course.modules.reduce(
              (n, m) => n + m.lessons.length,
              0,
            );
            return (
              <li key={course.id} className="rounded-lg border bg-card p-5">
                <p className="mb-2 font-mono text-xs text-muted-foreground uppercase">
                  {course.track} · {course.level}
                </p>
                <h2 className="font-semibold">{course.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {course.summary}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {course.modules.length} modules · {lessonCount} lessons
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
