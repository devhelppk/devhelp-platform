import type { Metadata } from "next";
import { auth } from "@repo/auth";
import { clientEnv } from "@repo/env/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account/account-form";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { PageHeader } from "@repo/ui/components/page-header";
import { Shell } from "@/components/shell/shell";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?callbackURL=%2Faccount");
  const q = await searchParams;
  return (
    <Shell wide callbackURL="/account">
      <div className="flex flex-col gap-8">
        <PageHeader title="Account" />
        {/* A status banner, not a description: it appears once, after following
            the verification link, and belongs in the flow rather than the
            header's subtitle slot. */}
        {q.verified === "1" && !q.error ? (
          <p
            role="status"
            className="rounded-lg border border-primary/60 bg-primary/5 px-4 py-3 text-sm"
          >
            Email verified. Thank you.
          </p>
        ) : null}
        <LearnerProviders>
          <AccountForm lmsUrl={clientEnv.NEXT_PUBLIC_SITE_URL} />
        </LearnerProviders>
      </div>
    </Shell>
  );
}
