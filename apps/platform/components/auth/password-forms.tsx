"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const [state, setState] = useState<{
    sent?: boolean;
    error?: string;
    busy?: boolean;
  }>({});
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ busy: true });
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setState(
      res.error
        ? { error: res.error.message ?? "Could not send the email." }
        : { sent: true },
    );
  }
  if (state.sent)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        If that address has an account, a reset link is on its way. It works for
        one hour.
      </p>
    );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={state.busy}>
        {state.busy ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; busy?: boolean }>({});
  if (!token)
    return (
      <p role="alert" className="text-sm text-destructive">
        This reset link is missing its token. Request a new one from the sign-in
        page.
      </p>
    );
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ busy: true });
    const newPassword = String(
      new FormData(e.currentTarget).get("password") ?? "",
    );
    const res = await authClient.resetPassword({ newPassword, token: token! });
    if (res.error) {
      setState({
        error: res.error.message ?? "That link is invalid or expired.",
      });
      return;
    }
    router.push("/sign-in?reset=1");
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={state.busy}>
        {state.busy ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
