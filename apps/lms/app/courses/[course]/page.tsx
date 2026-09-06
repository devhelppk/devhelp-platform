import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import { Badge } from "@repo/ui/components/badge";
import { PageHeader } from "@repo/ui/components/page-header";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatDuration, ProgressBar } from "@/components/learning/course-card";
import { EnrolButton } from "@/components/learning/enrol-button";
import { LessonList } from "@/components/learning/lesson-list";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const { course: slug } = await params;
  const caller = await api(new Headers(await headers()));
  const course = await caller.catalogue.getCourse({ slug });
  if (!course) notFound();
  const progress = await caller.learning.myProgress({ courseSlug: slug });
  const signedIn = !!(await auth.api.getSession({ headers: await headers() }));
  const status = new Map(
    progress.lessons.map((l) => [l.slug, l.progress?.status ?? null]),
  );
  const continueHref = `/courses/${slug}/${progress.continue?.slug ?? course.modules[0]?.lessons[0]?.slug ?? ""}`;

  return (
    <Page>
      <div className="flex flex-col gap-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/courses" className="hover:text-foreground">
            Courses
          </Link>{" "}
          / {course.track === "technical" ? "Technical" : "Career"}
        </p>
        <PageHeader
          title={course.title}
          description={course.description ?? course.summary}
          actions={
            <LearnerProviders>
              <Suspense>
                <EnrolButton
                  courseSlug={slug}
                  continueHref={continueHref}
                  enrolled={
                    progress.enrollment?.status === "active" ||
                    progress.enrollment?.status === "completed"
                  }
                  signedIn={signedIn}
                />
              </Suspense>
            </LearnerProviders>
          }
        />
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">
            {course.level}
          </Badge>
          <Badge variant="outline">
            {course.lessonCount}{" "}
            {course.lessonCount === 1 ? "lesson" : "lessons"}
          </Badge>
          <Badge variant="outline">
            {formatDuration(course.durationMinutes)}
          </Badge>
          {course.prerequisites.map((p) => (
            <Badge key={p.slug} variant="secondary" asChild>
              <Link href={`/courses/${p.slug}`}>Needs: {p.title}</Link>
            </Badge>
          ))}
        </div>
        {progress.enrollment ? (
          <ProgressBar
            value={progress.enrollment.progressPercent}
            label={
              progress.enrollment.status === "completed"
                ? "Completed"
                : `${progress.enrollment.progressPercent}% complete`
            }
          />
        ) : null}
        <LessonList
          courseSlug={slug}
          modules={course.modules.map((m) => ({
            slug: m.slug,
            title: m.title,
            lessons: m.lessons.map((l) => ({
              slug: l.slug,
              title: l.title,
              type: l.type,
              durationMinutes: l.durationMinutes,
              isRequired: l.isRequired,
              status: status.get(l.slug) ?? null,
            })),
          }))}
        />
      </div>
    </Page>
  );
}
