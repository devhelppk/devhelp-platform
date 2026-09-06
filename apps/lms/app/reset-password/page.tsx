import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { SmallPage } from "@/components/auth/small-page";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const token = typeof q.token === "string" ? q.token : null;
  const error = typeof q.error === "string" ? q.error : null;
  return (
    <SmallPage
      title="Choose a new password"
      lead={
        error
          ? "That link is invalid or has expired. Request a new one."
          : undefined
      }
    >
      <ResetPasswordForm token={error ? null : token} />
    </SmallPage>
  );
}
