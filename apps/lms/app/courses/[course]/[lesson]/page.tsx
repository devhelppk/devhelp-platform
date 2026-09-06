import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import {
  AppShell,
  AppShellContent,
  AppShellHeader,
} from "@repo/ui/components/app-shell";
import { Badge } from "@repo/ui/components/badge";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonList } from "@/components/learning/lesson-list";
import { LessonNav, neighbours } from "@/components/learning/lesson-nav";
import { MarkDoneButton } from "@/components/learning/mark-done-button";
import { VideoPlayer } from "@/components/learning/video-player";
import { MDXContent } from "@/components/mdx/mdx-content";
import { AccountMenu } from "@/components/shell/account-menu";
import { LazyMobileNav } from "@/components/shell/lazy-mobile-nav";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { getCompiledLesson } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const caller = await api(new Headers(await headers()));
  const course = await caller.catalogue.getCourse({ slug: courseSlug });
  if (!course) notFound();
  const flat = course.modules.flatMap((m) => m.lessons);
  const lesson = flat.find((l) => l.slug === lessonSlug);
  if (!lesson) notFound();

  const progress = await caller.learning.myProgress({ courseSlug });
  const signedIn = !!(await auth.api.getSession({ headers: await headers() }));
  const status = new Map(
    progress.lessons.map((l) => [l.slug, l.progress?.status ?? null]),
  );
  const completed = status.get(lessonSlug) === "completed";
  const { prev, next } = neighbours(flat, lessonSlug);
  const nextHref = next ? `/courses/${courseSlug}/${next.slug}` : null;
  const compiled = lesson.contentPath
    ? getCompiledLesson(lesson.contentPath)
    : undefined;

  const sidebar = (
    <div className="flex flex-col gap-4 px-4 py-6">
      <Link
        href={`/courses/${courseSlug}`}
        className="text-sm font-semibold hover:underline"
      >
        {course.title}
      </Link>
      <LessonList
        compact
        courseSlug={courseSlug}
        currentSlug={lessonSlug}
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
  );

  return (
    <AppShell sidebar={sidebar}>
      <AppShellHeader>
        <LazyMobileNav title="Lessons">{sidebar}</LazyMobileNav>
        <Link href="/" className="hidden sm:block">
          <BrandLogo product="Learn" className="text-base" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          <Link
            href={`/courses/${courseSlug}`}
            className="hover:text-foreground"
          >
            {course.title}
          </Link>
          <span className="mx-1">/</span>
          <span className="text-foreground">{lesson.title}</span>
        </p>
        <ThemeToggle />
        <AccountMenu callbackURL={`/courses/${courseSlug}/${lessonSlug}`} />
      </AppShellHeader>
      <AppShellContent className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {lesson.title}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {lesson.type}
            </Badge>
            <Badge variant="outline">
              {lesson.mode === "industry"
                ? "Industry mode: AI allowed, you own correctness"
                : "Foundation mode: no AI"}
            </Badge>
            {lesson.durationMinutes ? (
              <Badge variant="outline">{lesson.durationMinutes} min</Badge>
            ) : null}
            {!lesson.isRequired ? (
              <Badge variant="outline">Optional</Badge>
            ) : null}
            {completed ? <Badge>Completed</Badge> : null}
          </div>
        </header>

        {lesson.type === "video" && lesson.videoId ? (
          <Suspense>
            <LearnerProviders>
              <VideoPlayer
                courseSlug={courseSlug}
                lessonSlug={lessonSlug}
                videoId={lesson.videoId}
                title={lesson.title}
                completed={completed}
                signedIn={signedIn}
              />
            </LearnerProviders>
          </Suspense>
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

        {lesson.type === "quiz" ||
        lesson.type === "exercise" ||
        lesson.type === "project" ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {lesson.type === "quiz"
              ? "The quiz runner arrives in the next release."
              : lesson.type === "exercise"
                ? "The in-browser exercise runner arrives in the next release."
                : "Project submissions arrive in a later release."}{" "}
            Read the lesson now; completion for this type comes with it.
          </div>
        ) : null}

        {lesson.completionRule === "view" && lesson.type !== "video" ? (
          <div className="flex justify-end">
            <Suspense>
              <LearnerProviders>
                <MarkDoneButton
                  courseSlug={courseSlug}
                  lessonSlug={lessonSlug}
                  completed={completed}
                  nextHref={nextHref}
                  signedIn={signedIn}
                />
              </LearnerProviders>
            </Suspense>
          </div>
        ) : null}

        <LessonNav courseSlug={courseSlug} prev={prev} next={next} />
        <p className="text-xs text-muted-foreground">
          Something wrong in this lesson?{" "}
          <a
            className="underline-offset-4 hover:underline"
            href="https://github.com/devhelppk/devhelp-content/issues/new"
          >
            Open an issue
          </a>
          .
        </p>
      </AppShellContent>
    </AppShell>
  );
}
