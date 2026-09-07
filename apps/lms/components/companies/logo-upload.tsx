"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { useActionState } from "react";
import {
  removeCompanyLogo,
  uploadCompanyLogo,
  type LogoResult,
} from "@/app/admin/companies/logo-action";
import { CompanyMark } from "./company-mark";

/** Admin logo upload (S10c). Small images only; no resizing or conversion. */
export function LogoUpload({
  slug,
  organizationId,
  hasLogo,
  version,
}: {
  slug: string;
  organizationId: string;
  hasLogo: boolean;
  version?: Date | null;
}) {
  const [state, action, pending] = useActionState(
    async (_prev: LogoResult | null, form: FormData) =>
      form.get("intent") === "remove"
        ? removeCompanyLogo(slug)
        : uploadCompanyLogo(slug, form),
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <CompanyMark id={organizationId} version={version} size={56} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Logo</span>
          <span className="text-xs text-muted-foreground">
            PNG, JPEG, WebP, or SVG, up to 256 KB. Without one, the icon from
            the company's own website is used; without that, its initials.
          </span>
        </div>
      </div>
      <Input
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="max-w-sm"
        aria-label="Logo file"
      />
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-muted-foreground">Saved.</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Upload logo"}
        </Button>
        {hasLogo ? (
          <Button
            type="submit"
            name="intent"
            value="remove"
            size="sm"
            variant="ghost"
            disabled={pending}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}
