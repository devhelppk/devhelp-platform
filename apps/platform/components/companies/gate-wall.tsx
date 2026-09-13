import { Lock } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import type { Route } from "next";
import Link from "next/link";
import { ClaimDialog } from "./claim-dialog";
import { ContributeDialog } from "./contribute-dialog";

/**
 * What an ineligible viewer sees instead of the company's contributed content
 * (S15 part B).
 *
 * **A CSS blur is not a gate.** Blurring real rows client-side leaves every word
 * in the RSC payload, in view-source, and one devtools toggle away. So every
 * string below is written here, in this file, by us: the mockup is synthetic
 * placeholder text that never touched the database, and the page does not fetch
 * the real rows at all when this renders. The blur is decoration on top of that
 * — it says "there is something here", it is not what keeps it hidden.
 */

/** Fixed, obviously-fake copy. Not a sample of anyone's review. */
const MOCKUP = [
  {
    role: "Backend engineer",
    stars: 4,
    good: "Mentorship was real — a senior reviewed every pull request in my first month.",
    bad: "Release weeks are long, and the on-call rota is thin.",
  },
  {
    role: "Frontend engineer",
    stars: 3,
    good: "Modern stack and freedom to choose libraries within reason.",
    bad: "Salary bands are not written down, so a raise is a negotiation.",
  },
  {
    role: "QA engineer",
    stars: 5,
    good: "The test culture is taken seriously rather than bolted on at the end.",
    bad: "Career ladder past senior is still being figured out.",
  },
] as const;

function reason(
  kind: "signed_out" | "needs_verification" | "needs_contribution",
  companyName: string,
) {
  switch (kind) {
    case "signed_out":
      return {
        title: "Sign in to read what people say",
        body: `Reviews, interview experiences and pay at ${companyName} are written by learners for learners. Reading them needs an account, so that what people share stays between people who share.`,
      };
    case "needs_verification":
      return {
        title: "Verify your email to read the rest",
        body: "One click on the link we sent, and this page opens. Verification is what keeps a review bank from being scraped by anyone who can fill a form.",
      };
    case "needs_contribution":
      return {
        title: "Share one experience to read the rest",
        body: `Everything on this page was written by someone who had nothing to gain from writing it. Add one review, interview or pay data point — at ${companyName} or anywhere you have worked — and the bank opens for a year.`,
      };
  }
}

export function GateWall({
  kind,
  slug,
  companyName,
  signedIn,
  emailVerified,
}: {
  kind: "signed_out" | "needs_verification" | "needs_contribution";
  slug: string;
  companyName: string;
  signedIn: boolean;
  emailVerified: boolean;
}) {
  const { title, body } = reason(kind, companyName);
  return (
    <section
      aria-labelledby="gate-title"
      /* One grid cell holding both layers, rather than an absolute overlay on
         a relative box: the section then grows to whichever layer is taller, so
         the notice is never clipped by three short mockup cards. */
      className="grid overflow-hidden rounded-lg border *:[grid-area:1/1]"
    >
      {/* Synthetic, and told so to a screen reader, which cannot see a blur. */}
      <div
        aria-hidden="true"
        className="pointer-events-none grid gap-4 p-4 blur-[5px] select-none sm:grid-cols-2 lg:grid-cols-3"
      >
        {MOCKUP.map((m) => (
          <div
            key={m.role}
            className="flex flex-col gap-2 rounded-md border p-4"
          >
            <p className="text-sm font-medium">{m.role}</p>
            <p className="text-xs text-muted-foreground">
              {"★".repeat(m.stars)}
              {"☆".repeat(5 - m.stars)}
            </p>
            <p className="text-sm">{m.good}</p>
            <p className="text-sm text-muted-foreground">{m.bad}</p>
          </div>
        ))}
      </div>

      {/* `relative z-10` on both layers, and it is load-bearing: `filter`
          makes the blurred layer its own stacking context, which paints with
          the positioned layer — above a plain block sibling that comes after
          it. Without this the mockup's text shows through the notice card. */}
      <div className="relative z-10 bg-background/70" />

      <div className="relative z-10 flex items-center justify-center p-4">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center shadow-sm">
          <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
          <h2 id="gate-title" className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{body}</p>
          <p className="sr-only">
            The cards behind this notice are an example layout written by
            devhelp, not anyone&apos;s review.
          </p>
          {kind === "signed_out" ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" asChild>
                <Link
                  href={
                    `/sign-in?callbackURL=${encodeURIComponent(`/companies/${slug}`)}` as Route
                  }
                >
                  Sign in
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={
                    `/sign-up?callbackURL=${encodeURIComponent(`/companies/${slug}`)}` as Route
                  }
                >
                  Create an account
                </Link>
              </Button>
            </div>
          ) : (
            <ContributeDialog
              slug={slug}
              companyName={companyName}
              signedIn={signedIn}
              emailVerified={emailVerified}
            />
          )}
          {/* A representative of the company is not gated on their own company
              (D4), but they have to be a member first, so the way through is
              the claim flow rather than a contribution. */}
          <p className="text-xs text-muted-foreground">
            Work at {companyName}?{" "}
            <ClaimDialog
              slug={slug}
              companyName={companyName}
              signedIn={signedIn}
              emailVerified={emailVerified}
            />{" "}
            to read and reply without contributing.
          </p>
        </div>
      </div>
    </section>
  );
}
