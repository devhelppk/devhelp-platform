"use client";

import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

export function ResendVerification({
  size = "default",
}: {
  size?: "default" | "sm";
}) {
  const trpc = useTRPC();
  const [note, setNote] = useState<string | null>(null);
  const resend = useMutation(
    trpc.account.resendVerification.mutationOptions({
      onSuccess: (r) =>
        setNote(
          r.sent
            ? "Sent. Check your inbox (and spam)."
            : "This email is already verified.",
        ),
      onError: (e) => setNote(e.message),
    }),
  );
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={resend.isPending}
        onClick={() => resend.mutate()}
      >
        {resend.isPending ? "Sending…" : "Resend verification email"}
      </Button>
      {note ? (
        <p role="status" className="text-sm text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}
