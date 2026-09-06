import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import { Badge } from "@repo/ui/components/badge";
import type { Metadata } from "next";
import type { Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/shell/site-header";

export const metadata: Metadata = { title: "Your contributions" };
export const dynamic = "force-dynamic";

const statusText = {
  pending: "Waiting for review",
  published: "Published",
  hidden: "Hidden by a moderator",
  rejected: "Not published",
} as const;

/** Where each thing the learner submitted to the company bank stands. */
export default async function ContributionsPage() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/sign-in?callbackURL=%2Faccount%2Fcontributions");
  const caller = await api(new Headers(h));
  const { reviews, interviews, proposals } = await caller.contributions.mine();
  const empty =
    reviews.length === 0 && interviews.length === 0 && proposals.length === 0;
  return (
    <Page callbackURL="/account/contributions">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Your contributions
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Reviews, interview experiences, and companies you proposed. Nothing
            here shows your name to anyone else.
          </p>
        </header>
        {empty ? (
          <p className="text-sm text-muted-foreground">
            You have not contributed to the company bank yet.{" "}
            <Link href="/companies" className="underline underline-offset-4">
              Find a company you have worked at
            </Link>
            .
          </p>
        ) : null}
        <Section title="Reviews" empty={reviews.length === 0}>
          {reviews.map((r) => (
            <Row
              key={r.id}
              href={`/companies/${r.companySlug}`}
              title={r.companyName}
              detail={`${r.rating} / 5`}
              status={statusText[r.status]}
              at={r.createdAt}
            />
          ))}
        </Section>
        <Section title="Interview experiences" empty={interviews.length === 0}>
          {interviews.map((i) => (
            <Row
              key={i.id}
              href={`/companies/${i.companySlug}`}
              title={i.companyName}
              detail={i.outcome.replace(/_/g, " ")}
              status={statusText[i.status]}
              at={i.createdAt}
            />
          ))}
        </Section>
        <Section title="Companies you proposed" empty={proposals.length === 0}>
          {proposals.map((p) => (
            <Row
              key={p.id}
              href={p.status === "published" ? `/companies/${p.slug}` : null}
              title={p.name}
              detail=""
              status={statusText[p.status]}
              at={p.createdAt}
            />
          ))}
        </Section>
      </div>
    </Page>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (empty) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <ul className="divide-y rounded-lg border">{children}</ul>
    </section>
  );
}

function Row({
  href,
  title,
  detail,
  status,
  at,
}: {
  href: string | null;
  title: string;
  detail: string;
  status: string;
  at: Date;
}) {
  const name = href ? (
    <Link
      href={href as Route}
      className="font-medium underline-offset-4 hover:underline"
    >
      {title}
    </Link>
  ) : (
    <span className="font-medium">{title}</span>
  );
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      {name}
      <span className="text-muted-foreground capitalize">{detail}</span>
      <Badge
        variant={status === "Published" ? "secondary" : "outline"}
        className="ml-auto text-xs"
      >
        {status}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {at.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    </li>
  );
}
