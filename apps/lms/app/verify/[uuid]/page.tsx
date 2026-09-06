import type { Metadata } from "next";
import type { Route } from "next";
import { api } from "@repo/api/server";
import { Badge } from "@repo/ui/components/badge";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Button } from "@repo/ui/components/button";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import { clientEnv } from "@repo/env/client";
import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

/** Public and indexable: no session read, cached. */
export const revalidate = 300;

// Deduped: generateMetadata and the page both need it in one request.
const load = cache(async (uuid: string) => {
  if (!/^[0-9a-f-]{36}$/.test(uuid)) return null;
  const caller = await api(new Headers());
  return caller.certificates.byId({ id: uuid }).catch(() => null);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>;
}): Promise<Metadata> {
  const c = await load((await params).uuid);
  if (!c) return { title: "Certificate not found" };
  return {
    title: `${c.learnerName}: ${c.courseTitle}`,
    description: `${c.learnerName} completed ${c.courseTitle} on devhelp.pk on ${c.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.${c.revokedAt ? " This certificate has been revoked." : ""}`,
    robots: { index: true, follow: true },
  };
}

const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const c = await load((await params).uuid);
  if (!c) notFound();
  const commit = c.criteria.contentCommit ?? c.contentRevision?.commitSha;
  const repo =
    c.criteria.contentRepo ??
    c.contentRevision?.repo ??
    "devhelppk/devhelp-content";
  const quizByLesson = new Map(
    c.criteria.quizzes.map((q) => [q.lessonSlug, q]),
  );
  const extraQuizzes = c.criteria.quizzes.filter(
    (q) => !c.criteria.lessons.some((l) => l.slug === q.lessonSlug),
  );
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <BrandLogo product="Learn" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        {c.revokedAt ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/60 bg-destructive/5 px-4 py-3"
          >
            <p className="font-medium">
              This certificate was revoked on {fmt(c.revokedAt)}.
            </p>
            <p className="text-sm text-muted-foreground">
              Reason: {c.revokedReason}
            </p>
          </div>
        ) : null}
        <header className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Certificate of completion
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {c.learnerName}
          </h1>
          <p className="text-lg">
            completed{" "}
            <Link
              href={`/courses/${c.course.slug}` as Route}
              className="font-medium underline-offset-4 hover:underline"
            >
              {c.courseTitle}
            </Link>{" "}
            on {fmt(c.issuedAt)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">
              {c.course.track} track
            </Badge>
            {commit ? (
              <Badge variant="outline" asChild>
                <a
                  href={`https://github.com/${repo}/tree/${commit}`}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Content {commit.slice(0, 7)}
                </a>
              </Badge>
            ) : null}
            <Badge variant="outline">Certificate {c.id.slice(0, 8)}</Badge>
          </div>
        </header>

        <section aria-labelledby="done" className="flex flex-col gap-3">
          <h2 id="done" className="text-lg font-semibold">
            What was done
          </h2>
          <ul className="divide-y rounded-lg border">
            {c.criteria.lessons.map((l) => (
              <li
                key={l.slug}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <Check aria-hidden="true" className="size-4 text-primary" />
                <span className="flex-1">{l.title}</span>
                <span className="text-xs text-muted-foreground">
                  {quizByLesson.has(l.slug)
                    ? `quiz, best score ${quizByLesson.get(l.slug)!.bestScore}%, pass mark ${quizByLesson.get(l.slug)!.passScore}%`
                    : l.type}
                </span>
              </li>
            ))}
            {extraQuizzes.map((q) => (
              <li
                key={q.lessonSlug}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <Check aria-hidden="true" className="size-4 text-primary" />
                <span className="flex-1">{q.title}</span>
                <span className="text-xs text-muted-foreground">
                  best score {q.bestScore}%, pass mark {q.passScore}%
                </span>
              </li>
            ))}
            {c.criteria.projects.map((p) => (
              <li
                key={p.lessonSlug}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <Check aria-hidden="true" className="size-4 text-primary" />
                <span className="flex-1">{p.title}</span>
                <a
                  href={p.repoUrl}
                  className="text-xs underline underline-offset-4"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  repository
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Recorded at issue time from the learner&apos;s progress; later
            changes to the course do not alter it. Course criteria:
            {c.criteria.criteria.requireAllRequiredLessons
              ? " all required lessons"
              : ""}
            {c.criteria.criteria.minQuizScore !== undefined
              ? `, quiz average ≥ ${c.criteria.criteria.minQuizScore}%`
              : ""}
            {c.criteria.criteria.requireProjectAccepted
              ? ", an accepted project"
              : ""}
            .
          </p>
        </section>

        {!c.revokedAt ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a
                href={`${clientEnv.NEXT_PUBLIC_LMS_URL}/api/certificates/${c.id}.pdf`}
              >
                Download PDF
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/courses/${c.course.slug}` as Route}>
                See the course
              </Link>
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          devhelp.pk is a free, open learning platform for software engineers in
          Pakistan. Certificates are issued automatically when a course&apos;s
          completion criteria are met and can be revoked by an administrator
          with a stated reason.
        </p>
      </main>
    </>
  );
}
