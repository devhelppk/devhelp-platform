"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";

/** One public review per learner, offered at ≥ 50 percent progress (F4.2). */
export function CourseReviewForm({ courseSlug }: { courseSlug: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const mine = useQuery(trpc.reviews.mine.queryOptions({ courseSlug }));
  const [rating, setRating] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation(
    trpc.reviews.submit.mutationOptions({
      onSuccess: async () => {
        setOpen(false);
        setError(null);
        await qc.invalidateQueries({ queryKey: trpc.reviews.pathKey() });
        router.refresh();
      },
      onError: (e) => setError(e.message),
    }),
  );
  const remove = useMutation(
    trpc.reviews.remove.mutationOptions({
      onSuccess: async () => {
        setRating(0);
        await qc.invalidateQueries({ queryKey: trpc.reviews.pathKey() });
        router.refresh();
      },
    }),
  );
  if (mine.isPending || mine.error) return null;
  const { review, canReview, progress, verified } = mine.data;
  if (!canReview && !review)
    return (
      <p className="text-sm text-muted-foreground">
        Reviews open at 50 percent of the course. You are at {progress} percent.
      </p>
    );
  if (!verified)
    return (
      <p className="text-sm text-muted-foreground">
        Verify your email (Account) to write a review.
      </p>
    );
  if (review && !open)
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          You rated this course {review.rating} out of 5
          {review.status === "hidden" ? " (hidden by a moderator)" : ""}.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRating(review.rating);
            setOpen(true);
          }}
        >
          Edit review
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate({ courseSlug })}
          disabled={remove.isPending}
        >
          Delete
        </Button>
      </div>
    );
  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Write a review
      </Button>
    );
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rating) return setError("Pick a star rating.");
    const f = new FormData(e.currentTarget);
    submit.mutate({
      courseSlug,
      rating,
      title: String(f.get("title") ?? "").trim() || undefined,
      body: String(f.get("body") ?? "").trim(),
    });
  }
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <div role="radiogroup" aria-label="Rating out of five" className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} stars`}
            onClick={() => setRating(n)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-6",
                rating >= n
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/50",
              )}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          name="title"
          maxLength={80}
          defaultValue={review?.title ?? ""}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="review-body">Your review</Label>
        <Textarea
          id="review-body"
          name="body"
          rows={4}
          required
          minLength={20}
          maxLength={2000}
          defaultValue={review?.body ?? ""}
          placeholder="What did it teach you, and who is it for?"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending
            ? "Saving…"
            : review
              ? "Update review"
              : "Publish review"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
