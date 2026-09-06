import type { Metadata } from "next";
import type { Route } from "next";
import { api } from "@repo/api/server";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Award } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ActivityGrid } from "@/components/badges/activity-grid";
import { BadgeGrid } from "@/components/badges/badge-grid";
import { StreakLine } from "@/components/badges/streak-line";
import { Page } from "@/components/shell/site-header";

export const dynamic = "force-dynamic";

// Deduped: generateMetadata and the page both need it in one request.
const load = cache(async (handle: string) => {
  const caller = await api(new Headers());
  return caller.profiles.byHandle({ handle }).catch(() => null);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const p = await load((await params).handle);
  return p
    ? {
        title: `${p.name} (@${p.handle})`,
        description: p.bio ?? `${p.name} on devhelp.pk`,
        robots: { index: true, follow: true },
      }
    : { title: "Profile not found", robots: { index: false } };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const p = await load((await params).handle);
  if (!p) notFound();
  const initials = p.name
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const since = p.createdAt.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  return (
    <Page callbackURL={`/u/${p.handle}`}>
      <div className="flex flex-col gap-8">
        <header className="flex items-start gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {p.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{p.handle}
              {p.city ? ` · ${p.city}` : ""} · member since {since}
              {p.role === "mentor" || p.role === "admin" ? (
                <Badge variant="outline" className="ml-2 capitalize">
                  {p.role}
                </Badge>
              ) : null}
            </p>
            {p.bio ? <p className="max-w-prose text-sm">{p.bio}</p> : null}
            <div className="flex flex-wrap gap-3 text-sm">
              {p.links?.github ? (
                <a
                  href={`https://github.com/${p.links.github}`}
                  className="underline underline-offset-4"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  GitHub
                </a>
              ) : null}
              {p.links?.website ? (
                <a
                  href={p.links.website}
                  className="underline underline-offset-4"
                  rel="noreferrer noopener nofollow"
                  target="_blank"
                >
                  Website
                </a>
              ) : null}
              {p.links?.linkedin ? (
                <a
                  href={p.links.linkedin}
                  className="underline underline-offset-4"
                  rel="noreferrer noopener nofollow"
                  target="_blank"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </div>
        </header>
        <section
          aria-labelledby="profile-certs"
          className="flex flex-col gap-3"
        >
          <h2 id="profile-certs" className="text-lg font-semibold">
            Certificates
          </h2>
          {p.certificates.length ? (
            <ul className="divide-y rounded-lg border">
              {p.certificates.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                >
                  <Award aria-hidden="true" className="size-4 text-primary" />
                  <Link
                    href={`/verify/${c.id}` as Route}
                    className="flex-1 font-medium underline-offset-4 hover:underline"
                  >
                    {c.courseTitle}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.issuedAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No certificates yet.
            </p>
          )}
        </section>
        <section
          aria-labelledby="profile-badges"
          className="flex flex-col gap-3"
        >
          <h2 id="profile-badges" className="text-lg font-semibold">
            Badges
          </h2>
          <BadgeGrid
            items={p.badges.map((b) => ({ ...b.badge, earnedAt: b.awardedAt }))}
          />
        </section>
        <section
          aria-labelledby="profile-activity"
          className="flex flex-col gap-3"
        >
          <h2 id="profile-activity" className="text-lg font-semibold">
            Activity
          </h2>
          <StreakLine streak={p.streak} />
          {p.streak.activeDays > 1 ? <ActivityGrid days={p.activity} /> : null}
        </section>
      </div>
    </Page>
  );
}
