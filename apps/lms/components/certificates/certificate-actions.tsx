"use client";

import { Button } from "@repo/ui/components/button";
import { Copy, Download, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";

/** Verify link copy, PDF download, and the LinkedIn "Add to profile" link. Client-only for the clipboard. */
export function CertificateActions({
  id,
  courseTitle,
  issuedAt,
  lmsUrl,
}: {
  id: string;
  courseTitle: string;
  issuedAt: string;
  lmsUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const verifyUrl = `${lmsUrl}/verify/${id}`;
  const d = new Date(issuedAt);
  const linkedin = new URL("https://www.linkedin.com/profile/add");
  linkedin.searchParams.set("startTask", "CERTIFICATION_NAME");
  linkedin.searchParams.set("name", `${courseTitle} (devhelp.pk)`);
  linkedin.searchParams.set("organizationName", "devhelp.pk");
  linkedin.searchParams.set("issueYear", String(d.getFullYear()));
  linkedin.searchParams.set("issueMonth", String(d.getMonth() + 1));
  linkedin.searchParams.set("certUrl", verifyUrl);
  linkedin.searchParams.set("certId", id);
  return (
    /* Verify, PDF and Copy act on the certificate here; Add to LinkedIn sends
       the reader somewhere else, so it is pushed to the far end rather than
       sitting fourth in a row of four identical-looking buttons. */
    <div className="flex w-full flex-wrap items-center gap-2">
      {/* The verify page had no button of its own: the only way to it was the
          course title, which does not read as a link. It is the thing a
          certificate is *for*, so it gets a control. */}
      <Button size="sm" variant="outline" asChild>
        <Link href={`/verify/${id}` as Route}>
          <ShieldCheck aria-hidden="true" /> Verify
        </Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        {/* New tab, and the route serves the PDF `inline`, so this opens a
            viewer rather than silently writing to the Downloads folder. */}
        <a
          href={`${lmsUrl}/api/certificates/${id}.pdf`}
          target="_blank"
          rel="noopener"
        >
          <Download aria-hidden="true" /> PDF
        </a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(verifyUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        <Copy aria-hidden="true" /> {copied ? "Copied" : "Copy verify link"}
      </Button>
      <Button size="sm" variant="ghost" asChild className="sm:ml-auto">
        <a href={linkedin.toString()} target="_blank" rel="noreferrer noopener">
          <ExternalLink aria-hidden="true" /> Add to LinkedIn
        </a>
      </Button>
    </div>
  );
}
