import type { Metadata } from "next";
import type { Route } from "next";
import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CertificateCard } from "@/components/certificates/certificate-card";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?callbackURL=%2Fcertificates");
  const caller = await api(await headers());
  const certs = await caller.certificates.mine();
  return (
    <Page callbackURL="/certificates">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Certificates
          </h1>
          <p className="text-sm text-muted-foreground">
            Issued automatically when you finish a course. Each verify link
            shows exactly what you did.
          </p>
        </header>
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
    </Page>
  );
}
