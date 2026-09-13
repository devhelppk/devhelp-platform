"use client";

import { LearnerProviders } from "@/components/shell/learner-providers";
import { ClaimForm } from "./claim-form";

/** Lazily imported by the claim dialog, so its tRPC provider never loads for a reader. */
export function ClaimPanel({
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
      <ClaimForm
        slug={slug}
        companyName={companyName}
        emailVerified={emailVerified}
      />
    </LearnerProviders>
  );
}
