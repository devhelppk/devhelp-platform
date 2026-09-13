"use client";

import { Button } from "@repo/ui/components/button";
import { useEffect } from "react";

/** Route error boundary: keeps the shell, says what happened, offers a retry. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm text-muted-foreground">Something went wrong</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        We could not load this page.
      </h1>
      <p className="max-w-prose text-muted-foreground">
        Your progress is safe. Try again in a moment; if it keeps happening,
        open an issue on GitHub with the code below.
      </p>
      {error.digest ? (
        <code className="font-mono text-xs text-muted-foreground">
          {error.digest}
        </code>
      ) : null}
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
