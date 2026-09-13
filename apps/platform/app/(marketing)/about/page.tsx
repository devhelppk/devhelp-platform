import type { Metadata } from "next";
import type { Route } from "next";
import type * as React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/components/page-header";
import { BankFrame } from "@/components/marketing/bank-frame";
import { ReaderFrame } from "@/components/marketing/reader-frame";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why devhelp exists: the gap between a Pakistani CS degree and a modern engineering job, and what a free, open-source platform can do about it.",
  alternates: { canonical: "/about" },
};

const FIRST_LESSON = "/courses/ai-engineering-foundations/welcome" as Route;

const PRINCIPLES: { title: string; body: React.ReactNode }[] = [
  {
    title: "The unit of learning is a failure.",
    body: "Not a feature built from an empty folder, but a working system that breaks — because that is the shape of every real ticket.",
  },
  {
    title: "Judgement over recall.",
    body: "The debrief on an exercise asks what failed, what pattern it belongs to, what the trade-off was, and what should make you look for it next time.",
  },
  {
    title: "A stated position on AI.",
    body: "Every lesson says whether you should use it. Pretending it does not exist teaches nothing; letting it write everything teaches less.",
  },
  {
    title: "A small catalogue.",
    body: "Finishing it should mean something. Twenty-five shallow courses mean nothing.",
  },
  {
    title: "Communication counts as engineering.",
    body: "Offshore hires usually fail on writing and clarity, not on code, so that is a track and not an afterthought.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        title="Why this exists"
        description="The semester nobody runs, free, for anyone."
        actions={
          <Button size="lg" asChild>
            <Link href={FIRST_LESSON}>Start the first lesson</Link>
          </Button>
        }
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <p className="text-lg text-pretty">
            Pakistan graduates tens of thousands of computer science students a
            year. The industry they are graduating into moved again in 2026:
            code is cheap to generate and expensive to be responsible for, and
            the work that is left is reading systems you did not write, deciding
            what is correct, and saying so clearly to people in another
            timezone.
          </p>
          <p className="text-pretty text-muted-foreground">
            That is not a complaint about universities. A degree teaches you
            computer science, and it should. What is missing is the semester
            nobody runs: the one where you work inside a codebase that already
            exists, under a problem that is already happening, with the habits
            that make you useful in a team. devhelp is an attempt at that
            semester.
          </p>
        </div>
        <ReaderFrame />
      </div>

      <section className="mt-12 flex flex-col gap-4 border-t py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Who it is for
        </h2>
        <p className="max-w-prose text-muted-foreground">
          The final-year student with a degree and no production experience. The
          fresh graduate whose interviews keep ending at the take-home. The
          engineer two years in who is good at shipping features and was never
          taught how to debug something they did not write, how to argue for a
          trade-off in writing, or what they should be paid. No fees and no
          application, whatever your university, wherever you are.
        </p>
      </section>

      <section className="flex flex-col gap-6 border-t py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          What we think teaching should look like
        </h2>
        <ol className="flex list-none flex-col gap-6">
          {PRINCIPLES.map((item, i) => (
            <li key={item.title} className="flex gap-4">
              <span className="font-display text-2xl font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-display text-xl font-semibold">
                  {item.title}
                </p>
                <p className="max-w-prose text-pretty text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t py-12">
        <div className="grid gap-8 md:grid-cols-2 md:items-start">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              The company bank
            </h2>
            <p className="text-pretty text-muted-foreground">
              Deciding where to work is half of an early career, and in Pakistan
              the information to decide with barely exists. So the platform has
              a second half: reviews, interview experiences and real pay for
              software employers here, written by the people who worked there,
              published anonymously after a moderator reads them.
            </p>
            <p className="text-pretty text-muted-foreground">
              It is give-to-get — contribute one experience to read the rest —
              because a bank like this either belongs to the people who build it
              or it gets harvested by everyone except them. Pay appears only as
              aggregates with a floor of five reports per role, so no
              individual&apos;s salary can be read off a page.
            </p>
          </div>
          <BankFrame />
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          How it is built
        </h2>
        <p className="max-w-prose text-muted-foreground">
          In public, in two repositories, by whoever shows up. The curriculum is
          CC BY-SA 4.0 and the platform is MIT. Every architectural decision is
          written down in the repository with the reasoning and the things that
          were tried and abandoned — including the ones that were wrong.
        </p>
        <p className="max-w-prose text-muted-foreground">
          The whole platform runs on a laptop with Docker and no paid keys,
          which is a deliberate constraint: a university department or a student
          society should be able to run their own copy without a budget or a
          conversation with us.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          What it will never do
        </h2>
        <p className="max-w-prose text-muted-foreground">
          Charge for the curriculum. Run advertising. Sell data about learners
          or contributors. Put a course behind a certificate paywall. Email you
          anything you did not ask for — the platform sends transactional mail
          only, and badges are announced in the app.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Who is behind it
        </h2>
        <p className="max-w-prose text-muted-foreground">
          devhelp is a small open-source project, started and maintained by
          engineers in Pakistan, with mentors contributing lessons and reviews.
          If you want to be one of them, that door is{" "}
          <Link href="/contribute" className="underline underline-offset-4">
            open
          </Link>
          . For anything else, write to{" "}
          <a
            href="mailto:policy@devhelp.pk"
            className="underline underline-offset-4"
          >
            policy@devhelp.pk
          </a>
          .
        </p>
      </section>

      <div className="mt-4 flex flex-wrap gap-3 border-t pt-12">
        <Button variant="outline" asChild>
          <Link href="/courses">See the courses</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/roadmap">What is next</Link>
        </Button>
      </div>
    </main>
  );
}
