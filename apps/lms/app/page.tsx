import { Button } from "@repo/ui/components/button";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-semibold tracking-tight">
          devhelp{" "}
          <span className="font-normal text-muted-foreground">Learn</span>
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href="/courses">Browse courses</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-4 py-24">
        <h1 className="text-4xl font-semibold tracking-tight">Your courses</h1>
        <p className="max-w-xl text-muted-foreground">
          The LMS is under construction. Wire this page to{" "}
          <code className="font-mono text-sm">@repo/database</code> to list
          published courses once Postgres is running (
          <code className="font-mono text-sm">pnpm db:up</code>, then{" "}
          <code className="font-mono text-sm">
            pnpm db:migrate && pnpm content:refresh
          </code>
          ).
        </p>
      </section>
    </main>
  );
}
