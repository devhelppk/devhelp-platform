"use client";

import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { FLAG_REASONS, type FlagReason } from "./flag-reasons";
import { useTRPC } from "@/lib/trpc/client";

type Subject =
  "comment" | "course_review" | "company_review" | "interview_experience";

/**
 * Flag one piece of published content for a moderator. Collapsed to a button
 * until used, because on a page of reviews this control repeats and should not
 * compete with the content.
 */
export function FlagControl({
  subjectType,
  subjectId,
  label = "Flag",
  className,
}: {
  subjectType: Subject;
  subjectId: string;
  label?: string;
  className?: string;
}) {
  const trpc = useTRPC();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flag = useMutation(
    trpc.moderation.flag.mutationOptions({
      onSuccess: () => {
        setDone(true);
        setOpen(false);
      },
      onError: (e) => setError(e.message),
    }),
  );
  if (done)
    return (
      <span className={`text-xs text-muted-foreground ${className ?? ""}`}>
        Reported. Thank you.
      </span>
    );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    flag.mutate({
      subjectType,
      subjectId,
      reason: String(f.get("reason")) as FlagReason,
      details: String(f.get("details") ?? "").trim() || undefined,
    });
  }
  if (!open)
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-7 gap-1 px-2 text-muted-foreground ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        <Flag aria-hidden="true" className="size-3.5" /> {label}
      </Button>
    );
  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-2 rounded-md border bg-muted/40 p-3"
    >
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
      <Textarea id={`${id}-details`} name="details" rows={2} maxLength={1000} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={flag.isPending}>
          {flag.isPending ? "Sending…" : "Send report"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
