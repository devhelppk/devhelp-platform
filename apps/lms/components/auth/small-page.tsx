import { BrandLogo } from "@repo/ui/components/brand-logo";
import Link from "next/link";
import type { ReactNode } from "react";

/** Narrow centred page for auth-adjacent flows (verify, reset, invitations). */
export function SmallPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <Link href="/" className="self-start">
        <BrandLogo product="Learn" />
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        {lead ? <p className="text-sm text-muted-foreground">{lead}</p> : null}
      </div>
      {children}
    </main>
  );
}
