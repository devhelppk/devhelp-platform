"use client";

import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { Flag } from "lucide-react";
import Link from "next/link";
import { useActionState, useId } from "react";
import { flagCompanyContribution } from "@/app/companies/flag-action";
import { FLAG_REASONS } from "@/components/moderation/flag-reasons";

/**
 * Report a company review or interview experience. `<details>` does the
 * collapsing, so the closed state — which is what almost every reader sees —
 * costs nothing but markup; the small amount of client code here is for
 * showing the result without a full page navigation.
 */
export function FlagForm({
  subjectType,
  subjectId,
  slug,
  signedIn,
}: {
  subjectType: "company_review" | "interview_experience";
  subjectId: string;
  slug: string;
  signedIn: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(flagCompanyContribution, {});
  // Flagging needs a verified account. Offering the form to a signed-out
  // reader only to fail on submit wastes the one thing they were willing to do.
  if (!signedIn)
    return (
      <Link
        href={`/sign-in?callbackURL=${encodeURIComponent(`/companies/${slug}`)}`}
        className="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        <Flag aria-hidden="true" className="size-3" /> Sign in to report
      </Link>
    );
  if (state.ok)
    return (
      <span className="text-xs text-muted-foreground">
        Reported. Thank you.
      </span>
    );
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
        <Flag aria-hidden="true" className="size-3" /> Report
      </summary>
      <form
        action={action}
        className="mt-2 flex flex-col gap-2 rounded-md border bg-muted/40 p-3"
      >
        <input type="hidden" name="subjectType" value={subjectType} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <input type="hidden" name="slug" value={slug} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium">
            What is wrong with this?
          </legend>
          {FLAG_REASONS.map(([value, text], i) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reason"
                value={value}
                defaultChecked={i === 0}
                className="size-3.5 accent-brand-600"
              />
              {text}
            </label>
          ))}
        </fieldset>
        <label htmlFor={`${id}-details`} className="text-xs font-medium">
          Anything else a moderator should know (optional)
        </label>
        <Textarea
          id={`${id}-details`}
          name="details"
          rows={2}
          maxLength={1000}
        />
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="self-start"
        >
          {pending ? "Sending…" : "Send report"}
        </Button>
      </form>
    </details>
  );
}
