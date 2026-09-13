"use client";

import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ResendVerification } from "@/components/account/resend-verification";
import { useTRPC } from "@/lib/trpc/client";

/** Ask to represent a company. The evidence is computed here, not claimed. */
export function ClaimForm({
  slug,
  companyName,
  emailVerified,
}: {
  slug: string;
  companyName: string;
  emailVerified: boolean;
}) {
  const trpc = useTRPC();
  const [done, setDone] = useState<{ matched: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claim = useMutation(
    trpc.claims.request.mutationOptions({
      onSuccess: (r) => {
        setError(null);
        setDone(r);
      },
      onError: (e) => setError(e.message),
    }),
  );
  if (!emailVerified)
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm">
          Verify your email first — it is the evidence this whole request rests
          on.
        </p>
        <ResendVerification />
      </div>
    );
  if (done)
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm">
          {done.matched
            ? `Sent. Your email is at ${companyName}'s own domain, which an administrator will see. You will hear back here and by email.`
            : `Sent. Your email is not at ${companyName}'s domain, so an administrator will weigh what you wrote. You will hear back here and by email.`}
        </p>
        <Button asChild size="sm" variant="outline" className="self-start">
          <Link href={`/companies/${slug}` as Route}>
            Back to {companyName}
          </Link>
        </Button>
      </div>
    );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = String(
      new FormData(e.currentTarget).get("message") ?? "",
    ).trim();
    claim.mutate({ slug, message: message || undefined });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        We check whether your verified devhelp email is at {companyName}&apos;s
        own domain, and show an administrator the answer either way. A match is
        not automatic approval, and no match is not a refusal — a person reads
        every request.
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-sm font-medium">
          Anything an administrator should know
        </label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          maxLength={2000}
          placeholder="Your role, and how someone could confirm it."
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={claim.isPending} className="self-start">
        {claim.isPending ? "Sending…" : "Request access"}
      </Button>
    </form>
  );
}
