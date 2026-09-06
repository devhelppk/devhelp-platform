import { BrandLogo } from "@repo/ui/components/brand-logo";
import { env } from "@repo/env";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "./auth-form";

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const providers = {
    github: !!env.GITHUB_CLIENT_ID,
    google: !!env.GOOGLE_CLIENT_ID,
  };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <Link href="/" className="self-start">
        <BrandLogo product="Learn" />
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Pick up where you left off."
            : "Free forever. Your progress, certificates, and cohorts live here."}
        </p>
      </div>
      <Suspense>
        <AuthForm mode={mode} providers={providers} />
      </Suspense>
    </main>
  );
}
