import Link from "next/link";
import { clientEnv } from "@repo/env/client";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  BookOpen,
  Building2,
  GitPullRequest,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { SiteStructuredData } from "@/components/structured-data";
import { publishedCourses } from "@/lib/curriculum";

/**
 * The front door.
 *
 * Revalidated hourly rather than read fresh. The company pages are
 * `force-dynamic` because a hidden review must disappear at once; a marketing
 * page listing course titles has no such duty, and an hour-old title is fine.
 */
export const revalidate = 3600;

const LMS = clientEnv.NEXT_PUBLIC_LMS_URL;

/**
 * The first lesson of the flagship course: the primary call to action goes
 * straight into the reader, because a lesson needs no account and a catalogue
 * is one more decision between a visitor and the thing itself.
 */
const FIRST_LESSON = `${LMS}/courses/ai-engineering-foundations/welcome`;

const METHOD = [
  {
    icon: Wrench,
    title: "You debug a real repository",
    body: "A module is a working codebase that breaks under a scenario — a webhook delivered twice, a customer charged twice. You reproduce it, find it, fix it, and prove the fix with a test. Not a tutorial you retype.",
  },
  {
    icon: Search,
    title: "Trace the data",
    body: "One named method for finding your way around a codebase nobody explained to you: follow the data backwards from the symptom, forwards from the entry point, and sideways through the relationships. It is the skill that makes a first week survivable.",
  },
  {
    icon: ShieldCheck,
    title: "Foundation mode and industry mode",
    body: "Every lesson says which it is. Foundation mode: no AI, you are building the mental model. Industry mode: use AI, and you own whether the result is correct — which is exactly the job in 2026.",
  },
];

export default async function HomePage() {
  const courses = await publishedCourses();
  return (
    <>
      <SiteStructuredData />
      <SiteHeader />
      <main className="flex flex-col">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="flex max-w-3xl flex-col gap-6">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              The missing semester between your degree and your first
              engineering job.
            </h1>
            <p className="max-w-prose text-lg text-pretty text-muted-foreground">
              devhelp is a free, open-source platform for software engineers and
              students in Pakistan. You learn by fixing code that is already
              broken, the way the work actually arrives — and you can see what
              Pakistani employers really pay, interview like, and are like to
              work at.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <a href={FIRST_LESSON}>Start the first lesson</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={`${LMS}/courses`}>See the courses</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Read any lesson without an account. Sign in to keep your progress,
              earn badges, and get a certificate with a verification link.
            </p>
          </div>
        </section>

        {/* How it teaches */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance">
              Most courses teach you to build something that already works. This
              one starts with something that is broken.
            </h2>
            <div className="mt-10 grid gap-8 lg:grid-cols-3">
              {METHOD.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-3">
                  <Icon
                    aria-hidden="true"
                    className="size-5 text-brand-600 dark:text-brand-400"
                  />
                  <h3 className="font-display text-xl font-semibold">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The curriculum, by name and never by count. Hidden entirely when the
            list is empty, which is also the database-unavailable case. */}
        {courses.length > 0 ? (
          <section className="border-t">
            <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex max-w-2xl flex-col gap-3">
                  <h2 className="font-display text-3xl font-semibold tracking-tight">
                    What you can learn today
                  </h2>
                  <p className="text-muted-foreground">
                    The catalogue is deliberately small. Finishing it is meant
                    to mean something, which is not true of twenty-five shallow
                    courses.
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <a href={`${LMS}/courses`}>Browse the catalogue</a>
                </Button>
              </div>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((c) => (
                  <li key={c.slug} className="min-w-0">
                    <a
                      href={`${LMS}/courses/${c.slug}`}
                      className="flex h-full flex-col gap-3 rounded-lg border p-5 transition-colors hover:border-foreground/30"
                    >
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {c.track === "technical" ? "Technical" : "Career"}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {c.level}
                        </Badge>
                      </div>
                      <h3 className="font-display text-lg font-semibold">
                        {c.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {c.summary}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* The company bank: the part nobody else has. */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <div className="flex flex-col gap-4">
              <Building2
                aria-hidden="true"
                className="size-5 text-brand-600 dark:text-brand-400"
              />
              <h2 className="font-display text-3xl font-semibold tracking-tight text-balance">
                What it is actually like to work at a software company in
                Pakistan
              </h2>
              <p className="max-w-prose text-muted-foreground">
                Reviews, interview experiences and real pay for Pakistani
                employers, written by the people who worked there and published
                anonymously after a moderator reads them. Nobody is selling you
                a course, a referral, or a recruitment service.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href={`${LMS}/companies`}>Look up a company</a>
                </Button>
              </div>
            </div>
            <dl className="flex flex-col gap-5 rounded-lg border bg-background p-6 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="font-medium">Give to get</dt>
                <dd className="text-muted-foreground">
                  Facts about a company are open to everyone. Reading what
                  people wrote needs a verified email and one contribution of
                  your own — the only way a bank built by learners does not just
                  get harvested by everyone except them.
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-medium">Anonymous, and meant it</dt>
                <dd className="text-muted-foreground">
                  Published contributions never carry a name or an account id,
                  and dates are rounded to the month.
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-medium">Pay you cannot be identified by</dt>
                <dd className="text-muted-foreground">
                  Figures are aggregates only, withheld below five reports per
                  role and rounded, so no single person&apos;s salary can be
                  read off the page.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Open source */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="flex flex-col gap-4">
                <GitPullRequest
                  aria-hidden="true"
                  className="size-5 text-brand-600 dark:text-brand-400"
                />
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  Free, and open all the way down
                </h2>
                <p className="text-muted-foreground">
                  No fees, no paid tier, no advertising, no data to sell. The
                  curriculum is CC BY-SA, the platform is MIT, and the whole
                  thing runs on a laptop with Docker and no paid keys — so a
                  university or a society can teach from it without asking
                  anyone.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" asChild>
                    <Link href="/contribute">How to contribute</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/roadmap">Read the roadmap</Link>
                  </Button>
                </div>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                <li className="flex flex-col gap-2 rounded-lg border p-5">
                  <BookOpen aria-hidden="true" className="size-4" />
                  <p className="font-medium">devhelp-content</p>
                  <p className="text-sm text-muted-foreground">
                    Lessons, quizzes and exercises as MDX and YAML, CC BY-SA
                    4.0. A typo fix is a pull request; so is a new module.
                  </p>
                  <a
                    href="https://github.com/devhelppk/devhelp-content"
                    className="text-sm underline underline-offset-4"
                  >
                    devhelppk/devhelp-content
                  </a>
                </li>
                <li className="flex flex-col gap-2 rounded-lg border p-5">
                  <Wrench aria-hidden="true" className="size-4" />
                  <p className="font-medium">devhelp-platform</p>
                  <p className="text-sm text-muted-foreground">
                    The app, the API, the schema and the tooling, MIT. Clone it
                    and it runs end to end on your machine.
                  </p>
                  <a
                    href="https://github.com/devhelppk/devhelp-platform"
                    className="text-sm underline underline-offset-4"
                  >
                    devhelppk/devhelp-platform
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance">
              For the final-year student, the fresh graduate, and the engineer
              two years in who was never taught this part.
            </h2>
            <p className="max-w-prose text-muted-foreground">
              Whatever your university, wherever you are, whatever you can pay.
              Start reading; sign in when you want it to count.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href={FIRST_LESSON}>Start the first lesson</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/about">Why this exists</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
