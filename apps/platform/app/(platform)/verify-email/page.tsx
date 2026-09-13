import type { Route } from "next";
import { auth } from "@repo/auth";
import { Button } from "@repo/ui/components/button";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ResendVerification } from "@/components/account/resend-verification";
import { SmallPage } from "@/components/auth/small-page";
import { LearnerProviders } from "@/components/shell/learner-providers";
import { safePath } from "@/lib/safe-path";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const next = safePath(typeof q.next === "string" ? q.next : null);
  const error = typeof q.error === "string" ? q.error : null;
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (session?.user.emailVerified) {
    return (
      <SmallPage
        title="Email verified"
        lead="You can contribute reviews, questions, and projects now."
      >
        <Button asChild>
          <Link href={next as Route}>Continue</Link>
        </Button>
      </SmallPage>
    );
  }
  if (!session) {
    return (
      <SmallPage
        title="Check your inbox"
        lead="Open the link in the email we sent to confirm your address, then sign in."
      >
        <Button asChild>
          <Link
            href={`/sign-in?callbackURL=${encodeURIComponent(next)}` as Route}
          >
            Sign in
          </Link>
        </Button>
      </SmallPage>
    );
  }
  return (
    <SmallPage
      title={error ? "That link has expired" : "Check your inbox"}
      lead={
        error
          ? "Verification links work once and expire after an hour. Send a new one below."
          : `We sent a confirmation link to ${session.user.email}. Learning works without it; contributing needs it.`
      }
    >
      <LearnerProviders>
        <ResendVerification />
      </LearnerProviders>
      <Button variant="ghost" asChild>
        <Link href={next as Route}>Skip for now</Link>
      </Button>
    </SmallPage>
  );
}
