import { PageHeader } from "@repo/ui/components/page-header";
import type { Metadata } from "next";
import type { Route } from "next";
import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CertificateCard } from "@/components/certificates/certificate-card";
import { Shell } from "@/components/shell/shell";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?callbackURL=%2Fcertificates");
  const caller = await api(await headers());
  const certs = await caller.certificates.mine();
  return (
    <Shell wide callbackURL="/certificates">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Certificates"
          description="Issued automatically when you finish a course. Each verify link shows exactly what you did."
        />
        {certs.length ? (
          <div className="flex flex-col gap-3">
            {certs.map((c) => (
              <CertificateCard key={c.id} cert={c} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            None yet. Finish a course and it appears here.{" "}
            <Link
              href={"/courses" as Route}
              className="underline underline-offset-4"
            >
              Browse courses
            </Link>
            .
          </p>
        )}
      </div>
    </Shell>
  );
}
