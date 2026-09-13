import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

/**
 * The root 404, for URLs that match no route at all.
 *
 * Deliberately session-free (`SiteHeader static`): the root not-found boundary
 * is part of every page's tree, and a `headers()` read here made every public
 * page — `/about`, `/faq`, `/contribute`, `/design` — dynamic. A `notFound()`
 * inside a product page is caught by `(platform)/not-found.tsx`, which uses
 * `Shell` and so shows a signed-in person their rail.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader static />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-4 py-16">
          <p className="text-sm text-muted-foreground">404</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            That page is not here.
          </h1>
          <p className="max-w-prose text-muted-foreground">
            The course or lesson may have moved, or the link is wrong.
            Everything published is listed in the catalogue.
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
      </main>
      <SiteFooter />
    </div>
  );
}
