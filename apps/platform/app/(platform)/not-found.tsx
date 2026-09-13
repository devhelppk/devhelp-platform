import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import { Shell } from "@/components/shell/shell";

export default function NotFound() {
  return (
    <Shell>
      <section className="flex flex-col gap-4 py-16">
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          That page is not here.
        </h1>
        <p className="max-w-prose text-muted-foreground">
          The course or lesson may have moved, or the link is wrong. Everything
          published is listed in the catalogue.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/courses">Browse courses</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/home">Dashboard</Link>
          </Button>
        </div>
      </section>
    </Shell>
  );
}
