"use client";

import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { Flag } from "lucide-react";
import { useActionState, useId } from "react";
import { reportSalaryFigures } from "@/app/companies/flag-action";

/**
 * Report that a role's published figures look wrong. The target is the role,
 * not a salary: an individual figure is never shown, so there is nothing finer
 * a reader could point at. An admin, who can see every point, decides.
 */
export function ReportSalaries({
  slug,
  roleId,
  roleName,
  currency,
  signedIn,
}: {
  slug: string;
  roleId: string | null;
  roleName: string;
  currency: "PKR" | "USD";
  signedIn: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(reportSalaryFigures, {});
  if (!signedIn) return null;
  if (state.ok)
    return (
      <span className="text-xs text-muted-foreground">
        Reported. Thank you.
      </span>
    );
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 text-xs font-normal text-muted-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
        <Flag aria-hidden="true" className="size-3" /> Report
      </summary>
      <form
        action={action}
        className="mt-2 flex w-64 flex-col gap-2 rounded-md border bg-muted/40 p-3"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="roleId" value={roleId ?? ""} />
        <input type="hidden" name="currency" value={currency} />
        <label htmlFor={`${id}-details`} className="text-xs font-medium">
          What looks wrong about {roleName} pay in {currency}?
        </label>
        <Textarea
          id={`${id}-details`}
          name="details"
          rows={2}
          maxLength={1000}
        />
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="self-start"
        >
          {pending ? "Sending…" : "Send report"}
        </Button>
      </form>
    </details>
  );
}
