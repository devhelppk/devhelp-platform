"use client";

import { Button } from "@repo/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@repo/ui/components/sonner";
import type { Route } from "next";
import { useTRPC } from "@/lib/trpc/client";

export function MarkDoneButton({
  courseSlug,
  lessonSlug,
  completed,
  nextHref,
  signedIn,
}: {
  courseSlug: string;
  lessonSlug: string;
  completed: boolean;
  nextHref: string | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [done, setDone] = useState(completed);
  const complete = useMutation(
    trpc.learning.lessonCompleted.mutationOptions({
      onSuccess: async (r) => {
        setDone(true);
        await qc.invalidateQueries({ queryKey: trpc.learning.pathKey() });
        toast(
          r.courseCompleted
            ? "Course completed. Well done."
            : "Marked as done.",
        );
        // Sidebar ticks, badges and course progress are server-rendered.
        router.refresh();
        if (nextHref) router.push(nextHref as Route);
      },
      onError: (e) => toast(e.message),
    }),
  );

  if (done) {
    return (
      <Button variant="secondary" disabled>
        <Check aria-hidden="true" /> Done
      </Button>
    );
  }
  if (!signedIn) {
    return (
      <Button
        onClick={() =>
          router.push(
            `/sign-in?callbackURL=${encodeURIComponent(`/courses/${courseSlug}/${lessonSlug}`)}` as Route,
          )
        }
      >
        Sign in to track progress
      </Button>
    );
  }
  return (
    <Button
      disabled={complete.isPending}
      onClick={() => complete.mutate({ courseSlug, lessonSlug })}
    >
      {complete.isPending ? "Saving…" : "Mark as done"}
    </Button>
  );
}
