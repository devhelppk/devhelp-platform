import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Is devhelp really free, do you need an account, what a certificate means, why the catalogue is small, and how pay data is protected.",
  alternates: { canonical: "/faq" },
};

/**
 * The questions people actually ask, answered without hedging.
 *
 * Answers are JSX rather than strings because several of them need a link; the
 * page is one server component plus the accordion's own client behaviour.
 */
const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it really free? What is the catch?",
    a: (
      <>
        <p>
          It is free, and there is no catch to find later. No fees, no paid
          tier, no certificate paywall, no advertising, and nothing about you is
          sold — there is not even an analytics script on this page.
        </p>
        <p>
          The curriculum is CC BY-SA 4.0 and the platform is MIT, so the project
          cannot quietly close later: anyone can run their own copy of
          everything you are reading.
        </p>
      </>
    ),
  },
  {
    q: "Do I need an account?",
    a: (
      <>
        <p>
          Not to read. Every lesson, quiz question and exercise is readable
          signed out, and so are the facts about every company.
        </p>
        <p>
          An account is what makes it count: progress that resumes where you
          stopped, quiz and exercise results recorded, badges, streaks, and a
          certificate with a public verification link when you finish a course.
          Reading what people wrote about a company also needs one, because that
          part is give-to-get.
        </p>
      </>
    ),
  },
  {
    q: "Does a devhelp certificate mean anything to an employer?",
    a: (
      <>
        <p>
          It means exactly what it says, which is more than most certificates
          manage. The verification page lists the course, the date, and the
          criteria you actually met — lessons completed, quiz scores, exercises
          passed — and it is public, so a recruiter can check it without asking
          you for anything.
        </p>
        <p>
          What it is not is an exam we invigilated. Exercise results are
          reported by your browser today, so the honest signal is the work
          itself: the repositories you fixed and can talk about in an interview.
        </p>
      </>
    ),
  },
  {
    q: "Why are there so few courses?",
    a: (
      <>
        <p>
          Because the catalogue is meant to mean something when you finish it.
          Twenty-five shallow courses are easy to produce and worth nothing; a
          small set of courses that each put you inside a real, broken system is
          slow to write and worth something.
        </p>
        <p>
          The curriculum is being written in public, so you can see what is
          coming on the{" "}
          <Link href="/roadmap" className="underline underline-offset-4">
            roadmap
          </Link>{" "}
          — or write a lesson yourself.
        </p>
      </>
    ),
  },
  {
    q: "What is the company bank, and why do I have to contribute to read it?",
    a: (
      <>
        <p>
          It is reviews, interview experiences and real pay for software
          employers in Pakistan, written by people who worked there. Facts about
          a company — what it does, its size, its cities, whether it hires
          juniors — are open to everyone. What people wrote needs a verified
          email and one contribution of your own in the last year.
        </p>
        <p>
          The rule exists because a bank like this is built by learners and is
          otherwise scraped by everyone except them. One review, one interview
          account or one pay point opens it for a year.
        </p>
      </>
    ),
  },
  {
    q: "If I write a review, can my employer find out it was me?",
    a: (
      <>
        <p>
          Published contributions carry no name, no handle and no account id —
          the queries that build those pages select an explicit list of columns
          that excludes the author — and dates are rounded to the month. A
          company representative can reply to a review, but cannot edit, hide or
          remove it, and cannot see who wrote it.
        </p>
        <p>
          Your identity stays linked internally so moderators can act on a
          pattern and so the one-review-per-company rule works. See the{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy page
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    q: "How can you publish salaries without exposing individuals?",
    a: (
      <>
        <p>
          Pay is only ever shown as an aggregate, and three rules hold together:
          nothing appears below five reports for a role, every figure is rounded
          to a step, and the quartiles are withheld below eight reports.
        </p>
        <p>
          The rounding is not cosmetic. Percentile maths lands exactly on real
          values at small sample sizes, so a floor alone would have published
          individual salaries — which is precisely what a review of the feature
          caught before launch.
        </p>
      </>
    ),
  },
  {
    q: "Can my university or society teach from this?",
    a: (
      <>
        <p>
          Yes, and you do not need our permission. The curriculum is CC BY-SA
          4.0: run it as a course, translate it, print it, build on it — credit
          devhelp and share what you build under the same licence.
        </p>
        <p>
          The platform also runs on a laptop with Docker and no paid keys, so a
          department can host its own copy. Cohorts with a syllabus and shared
          progress are on the roadmap.
        </p>
      </>
    ),
  },
  {
    q: "What is this about AI in the lessons?",
    a: (
      <>
        <p>
          Every lesson states its mode. <strong>Foundation mode</strong> means
          no AI assistance: you are building the mental model, and a generated
          answer skips the part that makes you employable.{" "}
          <strong>Industry mode</strong> means use whatever you like, and you
          own whether the result is correct — which is the actual job now.
        </p>
      </>
    ),
  },
  {
    q: "Which languages and stacks does it teach?",
    a: (
      <>
        <p>
          Exercises run in the browser in JavaScript and TypeScript,
          deliberately — one runner done well rather than five done badly. The
          engineering ideas (tracing data, failure modes, trade-offs, testing,
          writing clearly) are not language-specific, and the career track is
          not technical at all.
        </p>
      </>
    ),
  },
  {
    q: "I found something wrong in a lesson. What do I do?",
    a: (
      <>
        <p>
          Open an issue or a pull request on the content repository — there is a
          link at the bottom of every lesson — or leave a question on the lesson
          itself, which mentors read. Corrections are the most welcome kind of
          contribution.
        </p>
        <p>
          <Link href="/contribute" className="underline underline-offset-4">
            How to contribute
          </Link>
        </p>
      </>
    ),
  },
  {
    q: "How do I delete my account?",
    a: (
      <>
        <p>
          Write to{" "}
          <a
            href="mailto:policy@devhelp.pk"
            className="underline underline-offset-4"
          >
            policy@devhelp.pk
          </a>{" "}
          and we will delete it, or export your data first if you want it. Your
          published contributions stay up and detached from you, which is the
          state they were already in from every reader&apos;s point of view.
        </p>
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">
        Questions
      </h1>
      <p className="mt-6 text-lg text-muted-foreground">
        If yours is not here, write to{" "}
        <a
          href="mailto:policy@devhelp.pk"
          className="underline underline-offset-4"
        >
          policy@devhelp.pk
        </a>
        .
      </p>

      <Accordion type="multiple" className="mt-10">
        {FAQS.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-left font-display text-lg">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3 text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <p className="mt-12 text-sm text-muted-foreground">
        Ready instead of reading?{" "}
        <Link
          href="/courses"
          className="underline underline-offset-4 hover:no-underline"
        >
          Start a course
        </Link>
        .
      </p>
    </main>
  );
}
