import type { AppRouter, inferRouterOutputs } from "@repo/api";
import { Badge } from "@repo/ui/components/badge";
import { Star } from "lucide-react";
import type { ReactNode } from "react";

type Review = inferRouterOutputs<AppRouter>["reviews"]["list"]["items"][number];

/** Server-rendered review list (indexable) with the personal form slot beside the heading. */
export function CourseReviews({
  reviews,
  ratingAvg,
  ratingCount,
  form,
}: {
  reviews: Review[];
  ratingAvg: string | null;
  ratingCount: number;
  form: ReactNode;
}) {
  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-heading" className="text-lg font-semibold">
          Reviews
          {ratingCount ? (
            <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <Star
                className="size-4 fill-primary text-primary"
                aria-hidden="true"
              />
              {Number(ratingAvg).toFixed(1)} from {ratingCount}{" "}
              {ratingCount === 1 ? "learner" : "learners"}
            </span>
          ) : (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              none yet
            </span>
          )}
        </h2>
        {form}
      </div>
      {reviews.length ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span aria-label={`${r.rating} out of 5`} className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={
                        n <= r.rating
                          ? "size-3.5 fill-primary text-primary"
                          : "size-3.5 text-muted-foreground/40"
                      }
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="font-medium text-foreground">
                  {r.user.name}
                </span>
                {r.user.city ? <span>{r.user.city}</span> : null}
                {r.completedAtReview ? (
                  <Badge variant="outline">Completed the course</Badge>
                ) : null}
                <span>
                  {new Date(r.createdAt).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              {r.title ? <p className="font-medium">{r.title}</p> : null}
              <p className="text-sm whitespace-pre-wrap">{r.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
