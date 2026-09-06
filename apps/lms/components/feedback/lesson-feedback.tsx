"use client";

import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

const TAGS = [
  ["unclear", "Unclear"],
  ["too_long", "Too long"],
  ["outdated", "Outdated"],
  ["error", "Has an error"],
  ["loved_it", "Loved it"],
] as const;
type Tag = (typeof TAGS)[number][0];

/** Two-tap private rating in the completion slot (F4.1). Never shown to other learners. */
export function LessonFeedback({
  courseSlug,
  lessonSlug,
}: {
  courseSlug: string;
  lessonSlug: string;
}) {
  const trpc = useTRPC();
  const mine = useQuery(
    trpc.feedback.mine.queryOptions({ courseSlug, lessonSlug }),
  );
  if (mine.isPending) return null;
  // The form owns its state from the loaded row; a saved rating re-mounts it with fresh initial values.
  return (
    <FeedbackForm
      key={mine.data?.updatedAt?.toString() ?? "new"}
      courseSlug={courseSlug}
      lessonSlug={lessonSlug}
      initial={mine.data ?? null}
    />
  );
}

function FeedbackForm({
  courseSlug,
  lessonSlug,
  initial,
}: {
  courseSlug: string;
  lessonSlug: string;
  initial: { rating: number; tags: string[]; text: string | null } | null;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<Tag[]>((initial?.tags as Tag[]) ?? []);
  const [text, setText] = useState(initial?.text ?? "");
  const [more, setMore] = useState(false);
  const [saved, setSaved] = useState(!!initial);
  const rate = useMutation(
    trpc.feedback.rate.mutationOptions({
      onSuccess: async () => {
        setSaved(true);
        await qc.invalidateQueries({
          queryKey: trpc.feedback.mine.queryKey({ courseSlug, lessonSlug }),
        });
      },
    }),
  );
  const submit = (next: { rating?: number; tags?: Tag[]; text?: string }) => {
    const r = next.rating ?? rating;
    if (!r) return;
    rate.mutate({
      courseSlug,
      lessonSlug,
      rating: r,
      tags: next.tags ?? tags,
      text: (next.text ?? text) || undefined,
    });
  };
  return (
    <section
      aria-labelledby="lesson-feedback"
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lesson-feedback" className="text-sm font-medium">
          {saved ? "Thanks for rating this lesson" : "How was this lesson?"}
        </h2>
        <div
          role="radiogroup"
          aria-label="Rating out of five"
          className="flex"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => {
                setRating(n);
                submit({ rating: n });
              }}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "size-5 transition-colors",
                  (hover || rating) >= n
                    ? "fill-primary text-primary"
                    : "text-muted-foreground/50",
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
      {rating ? (
        <div className="flex flex-wrap gap-2">
          {TAGS.map(([value, label]) => {
            const on = tags.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on
                    ? tags.filter((t) => t !== value)
                    : [...tags, value];
                  setTags(next);
                  submit({ tags: next });
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  on
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMore((m) => !m)}
          >
            {more ? "Hide note" : "Add a note"}
          </button>
        </div>
      ) : null}
      {rating && more ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit({ text });
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What was unclear, wrong, or great? Mentors read this."
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="self-start"
            disabled={rate.isPending}
          >
            Save note
          </Button>
        </form>
      ) : null}
      {rate.error ? (
        <p className="text-xs text-destructive">{rate.error.message}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Only mentors see your rating. It helps them fix lessons.
      </p>
    </section>
  );
}
