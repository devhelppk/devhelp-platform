import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { BookOpen, Wrench } from "lucide-react";
import { BankFrame } from "@/components/marketing/bank-frame";
import { ReaderFrame } from "@/components/marketing/reader-frame";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { SiteStructuredData } from "@/components/marketing/structured-data";
import { TraceFigure } from "@/components/marketing/trace-figure";
import { shellSession } from "@/components/shell/session";
import { publishedCourses } from "@/lib/curriculum";

/**
 * The first lesson of the flagship course: the primary call to action goes
 * straight into the reader, because a lesson needs no account and a catalogue
 * is one more decision between a visitor and the thing itself.
 */
const FIRST_LESSON = "/courses/ai-engineering-foundations/welcome" as Route;

const STEPS = [
  {
    title: "Understand",
    body: "Read the scenario and the codebase it happens in. Know what should have happened before you look for what did.",
  },
  {
    title: "Reproduce",
    body: "Make the failure happen on your own machine. A bug you cannot trigger is a bug you cannot prove fixed.",
  },
  {
    title: "Trace",
    body: "Follow the data backwards from the symptom to the line that caused it, writing down what you expected at each step.",
  },
  {
    title: "Fix and test",
    body: "Change the smallest thing that removes the cause. Then write the test that would have caught it.",
  },
  {
    title: "Explain",
    body: "Debrief in writing: the failure, the pattern behind it, the trade-off in the fix, and what should trigger it next time.",
  },
];

const METHOD = [
  {
    title: "You debug a real repository",
    body: "A module is a working codebase that breaks under a scenario — a webhook delivered twice, a customer charged twice. You reproduce it, find it, fix it, and prove the fix with a test. Not a tutorial you retype.",
  },
  {
    title: "Trace the data",
    body: "One named method for finding your way around a codebase nobody explained to you: follow the data backwards from the symptom, forwards from the entry point, and sideways through the relationships. It is the skill that makes a first week survivable.",
  },
  {
    title: "Foundation mode and industry mode",
    body: "Every lesson says which it is. Foundation mode: no AI, you are building the mental model. Industry mode: use AI, and you own whether the result is correct — which is exactly the job in 2026.",
  },
];

const BANK_FACTS = [
  {
    title: "Give to get",
    body: "Facts about a company are open to everyone. Reading what people wrote needs a verified email and one contribution of your own — the only way a bank built by learners does not just get harvested by everyone except them.",
  },
  {
    title: "Anonymous, and meant it",
    body: "Published contributions never carry a name or an account id, and dates are rounded to the month.",
  },
  {
    title: "Pay you cannot be identified by",
    body: "Figures are aggregates only, withheld below five reports per role and rounded, so no single person's salary can be read off the page.",
  },
];

const AUDIENCE = [
  {
    title: "The final-year student",
    body: "You have a degree and no production experience yet. This is the part of the job a degree does not reach, practised on code that behaves like production.",
  },
  {
    title: "The fresh graduate",
    body: "Your interviews keep ending at the take-home. The modules are practice at exactly what a take-home is testing: working in code you did not write.",
  },
  {
    title: "Two years in",
    body: "You are good at shipping features, and nobody taught you how to debug something you did not write, how to argue for a trade-off in writing, or what you should be paid.",
  },
];

function PrimaryActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" asChild>
        <Link href={FIRST_LESSON}>Start the first lesson</Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link href="/courses">See the courses</Link>
      </Button>
    </div>
  );
}

/**
 * The front door.
 *
 * Dynamic, because it reads the session: a signed-in visitor goes straight to
 * their dashboard at `/home`, and everyone else — every crawler included — gets
 * the landing. Sections alternate paper and mist; every section renders in
 * every state so the alternation never breaks.
 */
export default async function HomePage() {
  const session = await shellSession();
  if (session) redirect("/home");
  const courses = await publishedCourses();
  return (
    <>
      <SiteStructuredData />
      <main className="flex flex-col">
        {/* 1. Hero. Its own band, without the top rule under the header. */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-12 lg:items-center">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
            <h1 className="max-w-[18ch] font-display text-5xl font-medium tracking-tight text-balance sm:text-6xl">
              The missing semester between your degree and your first
              engineering job.
            </h1>
            <p className="max-w-prose text-lg text-pretty text-muted-foreground sm:text-xl">
              devhelp is a free, open-source platform for software engineers and
              students in Pakistan. You learn by fixing code that is already
              broken, the way the work actually arrives — and you can see what
              Pakistani employers really pay, interview like, and are like to
              work at.
            </p>
            <PrimaryActions />
            <p className="text-sm text-muted-foreground">
              Read any lesson without an account. Sign in when you want your
              progress kept.
            </p>
          </div>
          <TraceFigure className="lg:col-span-5" />
        </section>

        {/* 2. How a lesson works */}
        <Section tone="mist">
          <SectionHeading title="Most courses teach you to build something that already works. This one starts with something that is broken." />
          <ol className="mt-12 grid divide-y rounded-lg border bg-background md:grid-cols-5 md:divide-x md:divide-y-0">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex min-w-0 flex-col gap-2 p-5">
                <p className="text-sm text-muted-foreground">Step {i + 1}</p>
                <h3 className="font-display text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="text-sm text-pretty text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        {/* 3. The method */}
        <Section>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
            <ReaderFrame />
            <div className="flex flex-col gap-8">
              <SectionHeading
                title="One method, practised on real code"
                lead="Every module is a repository, a scenario that breaks it, and a lesson that walks you through finding out why."
              />
              <dl className="flex flex-col">
                {METHOD.map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col gap-2 border-t py-6 last:pb-0"
                  >
                    <dt className="font-display text-xl font-semibold">
                      {item.title}
                    </dt>
                    <dd className="max-w-prose text-muted-foreground">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Section>

        {/* 4. The curriculum, by name and never by count. The course list is
            hidden when empty (also the database-unavailable case); the section
            itself always renders so the tones keep alternating. */}
        <Section tone="mist">
          <SectionHeading
            title="What you can learn today"
            lead="The catalogue is deliberately small. Finishing it is meant to mean something, which is not true of twenty-five shallow courses."
          />
          {courses.length > 0 ? (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <li key={c.slug} className="min-w-0">
                  <Link
                    href={`/courses/${c.slug}` as Route}
                    className="flex h-full flex-col gap-3 rounded-lg border bg-background p-5 transition-colors hover:border-foreground/30"
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
                    <p className="text-sm text-muted-foreground">{c.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-10 flex max-w-prose flex-col gap-3 border-t pt-8">
            <h3 className="font-display text-xl font-semibold">
              Being written now, in the open
            </h3>
            <p className="text-muted-foreground">
              Core engineering, data structures, databases, the engineering
              flagship, and agentic AI. The roadmap says what is next and why.
            </p>
            <div>
              <Button variant="outline" asChild>
                <Link href="/roadmap">Read the roadmap</Link>
              </Button>
            </div>
          </div>
        </Section>

        {/* 5. The company bank: the part nobody else has. */}
        <Section>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <div className="flex flex-col gap-6">
              <SectionHeading
                title="What it is actually like to work at a software company in Pakistan"
                lead="Reviews, interview experiences and real pay for Pakistani employers, written by the people who worked there and published anonymously after a moderator reads them. Nobody is selling you a course, a referral, or a recruitment service."
              />
              <div>
                <Button asChild>
                  <Link href="/companies">Look up a company</Link>
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <BankFrame />
              <dl className="flex flex-col gap-4 text-sm">
                {BANK_FACTS.map((fact) => (
                  <div key={fact.title} className="flex flex-col gap-1">
                    <dt className="font-medium">{fact.title}</dt>
                    <dd className="text-muted-foreground">{fact.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Section>

        {/* 6. Who it is for */}
        <Section tone="mist">
          <SectionHeading
            title="Who it is for"
            lead="No fees and no application. Whatever your university, wherever you are."
          />
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {AUDIENCE.map((a) => (
              <div key={a.title} className="flex flex-col gap-3 border-t pt-6">
                <h3 className="font-display text-xl font-semibold">
                  {a.title}
                </h3>
                <p className="text-pretty text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 7. Open source */}
        <Section>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="flex flex-col gap-6">
              <SectionHeading
                title="Free, and open all the way down"
                lead="No fees, no paid tier, no advertising, no data to sell. The curriculum is CC BY-SA, the platform is MIT, and the whole thing runs on a laptop with Docker and no paid keys — so a university or a society can teach from it without asking anyone."
              />
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link href="/contribute">How to contribute</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/roadmap">Read the roadmap</Link>
                </Button>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:items-start">
              <li className="flex flex-col gap-2 rounded-lg border p-5">
                <h3 className="flex items-center gap-2 font-medium">
                  <BookOpen aria-hidden="true" className="size-4 shrink-0" />
                  devhelp-content
                </h3>
                <p className="text-sm text-muted-foreground">
                  Lessons, quizzes and exercises as MDX and YAML, CC BY-SA 4.0.
                  A typo fix is a pull request; so is a new module.
                </p>
                <a
                  href="https://github.com/devhelppk/devhelp-content"
                  className="text-sm underline underline-offset-4"
                >
                  devhelppk/devhelp-content
                </a>
              </li>
              <li className="flex flex-col gap-2 rounded-lg border p-5">
                <h3 className="flex items-center gap-2 font-medium">
                  <Wrench aria-hidden="true" className="size-4 shrink-0" />
                  devhelp-platform
                </h3>
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
        </Section>

        {/* 8. Closing CTA */}
        <Section tone="mist" innerClassName="flex flex-col items-start gap-6">
          <SectionHeading
            title="Start reading tonight. Sign in when you want it to count."
            lead="The first lesson needs no account, no fee and no application."
          />
          <PrimaryActions />
        </Section>
      </main>
    </>
  );
}
