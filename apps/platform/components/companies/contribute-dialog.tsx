"use client";

import { Button } from "@repo/ui/components/button";
import { PenLine } from "lucide-react";
import dynamic from "next/dynamic";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { parseAsBoolean, useQueryState } from "nuqs";

const ContributeModal = dynamic(
  () => import("./contribute-modal").then((m) => m.ContributeModal),
  { ssr: false },
);

/**
 * Sharing an experience opens here rather than navigating to its own page.
 *
 * Writing a review is a side errand from reading one: a full page change threw
 * away the reader's place on the company page and made "actually, not now" a
 * back navigation. Email verification, which used to be a page you arrived at
 * only to be turned away, is now a message inside the same dialog.
 *
 * Open state lives in the URL (`?share=true`, `shallow: true` — the server has
 * nothing to say about it), so the dialog is linkable, the back button closes it,
 * and a reload keeps it open. `/companies/<slug>/contribute` still exists and
 * still works, for anyone who lands there directly or has no JavaScript.
 */
export function ContributeDialog({
  slug,
  companyName,
  signedIn,
  emailVerified,
}: {
  slug: string;
  companyName: string;
  signedIn: boolean;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useQueryState(
    "share",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  if (!signedIn)
    return (
      <Button
        size="sm"
        onClick={() =>
          router.push(
            `/sign-in?callbackURL=${encodeURIComponent(`/companies/${slug}?share=true`)}` as Route,
          )
        }
      >
        <PenLine aria-hidden="true" />
        Share your experience
      </Button>
    );
  return (
    <>
      <Button size="sm" onClick={() => void setOpen(true)}>
        <PenLine aria-hidden="true" />
        Share your experience
      </Button>
      {open ? (
        <ContributeModal
          slug={slug}
          companyName={companyName}
          emailVerified={emailVerified}
          // `null` rather than `false` so closing removes the key instead of
          // leaving `?share=false` behind.
          onClose={() => void setOpen(null)}
        />
      ) : null}
    </>
  );
}
