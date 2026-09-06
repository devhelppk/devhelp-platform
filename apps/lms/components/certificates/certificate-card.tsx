import type { Route } from "next";
import { Badge } from "@repo/ui/components/badge";
import { clientEnv } from "@repo/env/client";
import { Award } from "lucide-react";
import Link from "next/link";
import { CertificateActions } from "./certificate-actions";

export function CertificateCard({
  cert,
}: {
  cert: {
    id: string;
    courseTitle: string;
    issuedAt: Date;
    revokedAt: Date | null;
    revokedReason: string | null;
    course: { slug: string };
  };
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Award aria-hidden="true" className="mt-0.5 size-5 text-primary" />
          <div className="flex flex-col">
            <Link
              href={`/verify/${cert.id}` as Route}
              className="font-medium underline-offset-4 hover:underline"
            >
              {cert.courseTitle}
            </Link>
            <span className="text-xs text-muted-foreground">
              Issued{" "}
              {cert.issuedAt.toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        {cert.revokedAt ? (
          <Badge variant="destructive">Revoked</Badge>
        ) : (
          <Badge>Completed</Badge>
        )}
      </div>
      {cert.revokedAt ? (
        <p className="text-sm text-muted-foreground">
          Revoked on{" "}
          {cert.revokedAt.toLocaleDateString("en-PK", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          : {cert.revokedReason}
        </p>
      ) : (
        <CertificateActions
          id={cert.id}
          courseTitle={cert.courseTitle}
          issuedAt={cert.issuedAt.toISOString()}
          lmsUrl={clientEnv.NEXT_PUBLIC_LMS_URL}
        />
      )}
    </article>
  );
}
