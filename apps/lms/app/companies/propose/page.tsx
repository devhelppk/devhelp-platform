import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProposeForm } from "@/components/companies/propose-form";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Propose a company" };
export const dynamic = "force-dynamic";

export default async function ProposeCompanyPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?callbackURL=%2Fcompanies%2Fpropose");
  return (
    <Page callbackURL="/companies/propose">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Propose a company
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Tell us about a software employer in Pakistan that is not in the
            directory yet. An administrator checks the facts against public
            sources before it appears.
          </p>
        </header>
        <LearnerProviders>
          <ProposeForm emailVerified={session.user.emailVerified} />
        </LearnerProviders>
      </div>
    </Page>
  );
}
