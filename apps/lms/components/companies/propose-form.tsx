"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ResendVerification } from "@/components/account/resend-verification";
import { useTRPC } from "@/lib/trpc/client";

/** Propose a company for the bank. It is invisible until an admin approves it. */
export function ProposeForm({ emailVerified }: { emailVerified: boolean }) {
  const trpc = useTRPC();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const propose = useMutation(
    trpc.companies.propose.mutationOptions({
      onSuccess: (r) => {
        setError(null);
        setDone(r.slug);
      },
      onError: (e) => setError(e.message),
    }),
  );
  if (!emailVerified)
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm">
          Verify your email before proposing a company. It keeps the bank
          honest.
        </p>
        <ResendVerification />
      </div>
    );
  if (done)
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm">
          Thank you. An administrator will check the details against public
          sources before the company appears in the directory. You can follow it
          on your{" "}
          <Link
            href="/account/contributions"
            className="underline underline-offset-4"
          >
            contributions page
          </Link>
          .
        </p>
        <Button asChild size="sm" variant="outline" className="self-start">
          <Link href={"/companies" as Route}>Back to companies</Link>
        </Button>
      </div>
    );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    propose.mutate({
      name: str("name") ?? "",
      website: str("website"),
      description: str("description"),
      industry: str("industry"),
      cities: (str("cities") ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      why: str("why"),
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" required minLength={2} maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://example.com"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" name="industry" maxLength={80} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cities">Cities</Label>
          <Input id="cities" name="cities" placeholder="Lahore, Karachi" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">What do they do?</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="why">Why should it be in the bank?</Label>
        <Textarea id="why" name="why" rows={2} maxLength={500} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={propose.isPending} className="self-start">
        {propose.isPending ? "Sending…" : "Propose company"}
      </Button>
    </form>
  );
}
