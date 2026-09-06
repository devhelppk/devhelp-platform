import type { Route } from "next";
import { auth } from "@repo/auth";
import { Button } from "@repo/ui/components/button";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AcceptInvitation } from "@/components/auth/accept-invitation";
import { SmallPage } from "@/components/auth/small-page";

export const metadata: Metadata = { title: "Invitation" };

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const here = `/accept-invitation/${id}`;
  if (!session)
    return (
      <SmallPage
        title="You have an invitation"
        lead="Sign in, or create an account with the invited email address, to accept it."
      >
        <div className="flex gap-2">
          <Button asChild>
            <Link
              href={`/sign-in?callbackURL=${encodeURIComponent(here)}` as Route}
            >
              Sign in
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              href={`/sign-up?callbackURL=${encodeURIComponent(here)}` as Route}
            >
              Create account
            </Link>
          </Button>
        </div>
      </SmallPage>
    );
  return (
    <SmallPage title="Join the organization">
      <AcceptInvitation id={id} />
    </SmallPage>
  );
}
