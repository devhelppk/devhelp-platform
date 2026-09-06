"use client";

import type { Route } from "next";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "sign-in" | "sign-up";

export function AuthForm({
  mode,
  providers,
}: {
  mode: Mode;
  providers: { github: boolean; google: boolean };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackURL = safeCallback(params.get("callbackURL"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const res =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password, callbackURL })
        : await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name") ?? ""),
            city: String(form.get("city") ?? "") || undefined,
            callbackURL,
          });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong. Try again.");
      return;
    }
    router.push(callbackURL as Route);
    router.refresh();
  }

  const social = (provider: "github" | "google") =>
    authClient.signIn.social({ provider, callbackURL });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {mode === "sign-up" ? (
        <>
          <Field label="Name" name="name" autoComplete="name" required />
          <Field
            label="City (optional)"
            name="city"
            autoComplete="address-level2"
            placeholder="Karachi"
          />
        </>
      ) : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        required
        minLength={8}
        hint={mode === "sign-up" ? "At least 8 characters." : undefined}
      />
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={busy}>
        {busy
          ? "Please wait…"
          : mode === "sign-in"
            ? "Sign in"
            : "Create account"}
      </Button>
      {providers.github || providers.google ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> or <Separator className="flex-1" />
          </div>
          <div className="flex flex-col gap-2">
            {providers.github ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => social("github")}
              >
                Continue with GitHub
              </Button>
            ) : null}
            {providers.google ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => social("google")}
              >
                Continue with Google
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? (
          <>
            New here?{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href={
                `/sign-up?callbackURL=${encodeURIComponent(callbackURL)}` as Route
              }
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href={
                `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}` as Route
              }
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  const id = `f-${input.name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        {...input}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Only same-origin paths are honoured, so a crafted link cannot bounce users elsewhere. */
export function safeCallback(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
