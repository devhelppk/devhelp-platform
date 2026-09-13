"use client";

import { Button } from "@repo/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";

export function EnrolButton({
  courseSlug,
  continueHref,
  enrolled,
  signedIn,
}: {
  courseSlug: string;
  continueHref: string;
  enrolled: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const enrol = useMutation(
    trpc.learning.enroll.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: trpc.learning.pathKey() });
        router.push(continueHref as Route);
      },
    }),
  );

  if (enrolled) {
    return (
      <Button size="lg" onClick={() => router.push(continueHref as Route)}>
        Continue
      </Button>
    );
  }
  if (!signedIn) {
    return (
      <Button
        size="lg"
        onClick={() =>
          router.push(
            `/sign-in?callbackURL=${encodeURIComponent(`/courses/${courseSlug}`)}` as Route,
          )
        }
      >
        Sign in to enrol
      </Button>
    );
  }
  return (
    <Button
      size="lg"
      disabled={enrol.isPending}
      onClick={() => enrol.mutate({ courseSlug })}
    >
      {enrol.isPending ? "Enrolling…" : "Enrol, it's free"}
    </Button>
  );
}
