"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Invitation = {
  organizationName: string;
  inviterEmail: string;
  email: string;
  status: string;
  expiresAt: Date | string;
};

export function AcceptInvitation({ id }: { id: string }) {
  const router = useRouter();
  const [inv, setInv] = useState<Invitation | null | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    authClient.organization.getInvitation({ query: { id } }).then((r) => {
      if (r.error || !r.data) {
        setError(r.error?.message ?? "Invitation not found.");
        setInv(null);
      } else setInv(r.data as unknown as Invitation);
    });
  }, [id]);
  async function accept() {
    setBusy(true);
    const r = await authClient.organization.acceptInvitation({
      invitationId: id,
    });
    setBusy(false);
    if (r.error)
      return setError(r.error.message ?? "Could not accept the invitation.");
    router.push("/");
    router.refresh();
  }
  if (inv === "loading")
    return (
      <p className="text-sm text-muted-foreground">Loading the invitation…</p>
    );
  if (!inv)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ?? "Invitation not found."}
      </p>
    );
  const expired =
    inv.status !== "pending" || new Date(inv.expiresAt) < new Date();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="font-medium">{inv.inviterEmail}</span> invited you to
        join <span className="font-medium">{inv.organizationName}</span>.
      </p>
      {expired ? (
        <p className="text-sm text-muted-foreground">
          This invitation is no longer open. Ask the organiser to send a new
          one.
        </p>
      ) : (
        <Button onClick={accept} disabled={busy}>
          {busy ? "Joining…" : "Accept and join"}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
