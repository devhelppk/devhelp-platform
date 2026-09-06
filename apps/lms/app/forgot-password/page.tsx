import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { SmallPage } from "@/components/auth/small-page";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <SmallPage
      title="Reset your password"
      lead="Enter your email and we will send a link to choose a new one."
    >
      <ForgotPasswordForm />
    </SmallPage>
  );
}
