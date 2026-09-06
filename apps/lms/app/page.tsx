import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/components/page-header";
import Link from "next/link";
import { headers } from "next/headers";
import { api } from "@repo/api/server";
import { TRPCError } from "@trpc/server";
import { ActivityGrid } from "@/components/badges/activity-grid";
import { BadgeGrid } from "@/components/badges/badge-grid";
import { StreakLine } from "@/components/badges/streak-line";
import { ContinueCard } from "@/components/learning/continue-card";
import { CourseCard } from "@/components/learning/course-card";
import { Page } from "@/components/shell/site-header";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const caller = await api(new Headers(await headers()));
  // Signed out → UNAUTHORIZED → landing. Anything else is a real error and must surface.
  const enrollments = await caller.learning
    .myEnrollments()
    .catch((err: unknown) => {
      if (err instanceof TRPCError && err.code === "UNAUTHORIZED") return null;
      throw err;
    });

  if (enrollments === null) {
    return (
      <Page>
        <section className="flex flex-col gap-6 py-10">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Learn the job, not just the syllabus.
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            Free courses for software engineers and students in Pakistan: the
            technical skills and the working habits that remote and offshore
            teams actually hire for.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/courses">Browse courses</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-up">Create a free account</Link>
            </Button>
          </div>
        </section>
      </Page>
    );
  }

  const active = enrollments.filter((e) => e.status === "active");
  const completed = enrollments.filter((e) => e.status === "completed");
  const latest = active[0];
  const [next, streak, activity, earned] = await Promise.all([
    latest
      ? caller.learning.continue({ courseSlug: latest.course.slug })
      : null,
    caller.learning.streak(),
    caller.learning.activity({ weeks: 53 }),
    caller.badges.mine(),
  ]);

  return (
    <Page wide>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="Your courses"
          description={
            enrollments.length
              ? "Pick up where you left off."
              : "You have not enrolled in anything yet."
          }
          actions={
            <Button variant="outline" asChild>
              <Link href="/courses">Browse courses</Link>
            </Button>
          }
        />
        <section className="flex flex-col gap-4">
          <StreakLine streak={streak} />
          {/* A year of empty squares says nothing to someone who just joined. */}
          {streak.activeDays > 1 ? <ActivityGrid days={activity} /> : null}
        </section>
        {latest && next ? (
          <ContinueCard
            courseSlug={latest.course.slug}
            courseTitle={latest.course.title}
            lessonSlug={next.slug}
            lessonTitle={next.title}
            progressPercent={latest.progressPercent}
          />
        ) : null}
        {enrollments.length === 0 ? (
          <section className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              Enrol in a course and it will show up here with your progress.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/courses">Find a course</Link>
            </Button>
          </section>
        ) : null}
        {active.length ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">In progress</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((e) => (
                <li key={e.courseId}>
                  <CourseCard
                    slug={e.course.slug}
                    title={e.course.title}
                    summary={e.course.summary}
                    track={e.course.track}
                    level={e.course.level}
                    durationMinutes={(e.course.estimatedHours ?? 0) * 60}
                    progressPercent={e.progressPercent}
                    status={e.status}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {completed.length ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Completed</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((e) => (
                <li key={e.courseId}>
                  <CourseCard
                    slug={e.course.slug}
                    title={e.course.title}
                    summary={e.course.summary}
                    track={e.course.track}
                    level={e.course.level}
                    durationMinutes={(e.course.estimatedHours ?? 0) * 60}
                    progressPercent={100}
                    status="completed"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Badges</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/badges">All badges</Link>
            </Button>
          </div>
          {earned.length ? (
            <BadgeGrid
              compact
              items={earned.map((e) => ({ ...e.badge, earnedAt: e.awardedAt }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              None yet. They arrive on their own as you work through lessons.
            </p>
          )}
        </section>
      </div>
    </Page>
  );
}
