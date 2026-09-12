"use client";

import dynamic from "next/dynamic";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { parseAsBoolean, useQueryState } from "nuqs";

const ClaimModal = dynamic(
  () => import("./claim-modal").then((m) => m.ClaimModal),
  { ssr: false },
);

/**
 * Claiming a profile (S13) opens in place, for the same reason as sharing an
 * experience: it is an aside from reading the page, not a destination.
 * `/companies/<slug>/claim` still works for a direct link.
 */
export function ClaimDialog({
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
    "claim",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const label = "Claim this profile";
  if (!signedIn)
    return (
      <button
        type="button"
        className="underline underline-offset-4"
        onClick={() =>
          router.push(
            `/sign-in?callbackURL=${encodeURIComponent(`/companies/${slug}?claim=true`)}` as Route,
          )
        }
      >
        {label}
      </button>
    );
  return (
    <>
      <button
        type="button"
        className="underline underline-offset-4"
        onClick={() => void setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <ClaimModal
          slug={slug}
          companyName={companyName}
          emailVerified={emailVerified}
          onClose={() => void setOpen(null)}
        />
      ) : null}
    </>
  );
}
