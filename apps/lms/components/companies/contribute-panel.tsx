"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { ContributeForm } from "./contribute-form";

/**
 * The contribute form and everything it needs, in a module of its own so the
 * dialog can `next/dynamic` it.
 *
 * This is the reason for the split: the form runs on tRPC, and the company page
 * deliberately ships no tRPC provider — it is public and indexable, and the
 * provider would load for every reader to support a control almost none of them
 * touch (the same reasoning as the flag controls in S10c). Importing it lazily
 * means first-load JS is unchanged and the cost lands only on the person who
 * opens the dialog.
 */
export function ContributePanel({
  slug,
  companyName,
  emailVerified,
}: {
  slug: string;
  companyName: string;
  emailVerified: boolean;
}) {
  return (
    <LearnerProviders>
      <Inner
        slug={slug}
        companyName={companyName}
        emailVerified={emailVerified}
      />
    </LearnerProviders>
  );
}

function Inner({
  slug,
  companyName,
  emailVerified,
}: {
  slug: string;
  companyName: string;
  emailVerified: boolean;
}) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(trpc.companies.filters.queryOptions());
  if (isPending || !data)
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  return (
    <ContributeForm
      slug={slug}
      companyName={companyName}
      emailVerified={emailVerified}
      roles={data.roles}
      cities={data.cities}
    />
  );
}
