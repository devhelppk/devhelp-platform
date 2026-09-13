import type { Route } from "next";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Button } from "@repo/ui/components/button";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import { Search } from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "@/components/notifications/bell";
import { AccountMenu } from "./account-menu";
import { shellSession } from "./session";
import { SiteFooter } from "./site-footer";

/**
 * The signed-out chrome: the marketing pages and every `Shell` page a signed-out
 * visitor (or a crawler) reads. Signed in, `Shell` renders `ToolsShell` instead.
 *
 * `static` renders the signed-out variant without reading the session, so a
 * page that must stay `force-static` (the Markdown documents, S23 D5) can use
 * it: a `headers()` call anywhere in the tree would make the page dynamic.
 */
export async function SiteHeader({
  callbackURL = "/home",
  static: isStatic = false,
}: {
  callbackURL?: string;
  static?: boolean;
}) {
  const session = isStatic ? null : await shellSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandLogo />
        </Link>
        {/* The links collapse before the action does: on a phone the one thing
            worth tapping is "Start learning", and every page is reachable from
            the footer. */}
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:inline-flex"
          >
            <Link href="/courses">Courses</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:inline-flex"
          >
            <Link href="/companies">Companies</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:inline-flex"
          >
            <Link href="/about">About</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild aria-label="Search">
            <Link href="/search">
              <Search aria-hidden="true" className="size-4" />
              <span className="sr-only sm:not-sr-only">Search</span>
            </Link>
          </Button>
          {/* Below `sm` the actions need the room; the theme follows the system there. */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          {session ? (
            <>
              <NotificationBell />
              <AccountMenu callbackURL={callbackURL} />
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hidden sm:inline-flex"
              >
                <Link
                  href={
                    `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}` as Route
                  }
                >
                  Sign in
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/courses">Start learning</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/**
 * `wide` is the data-dense shell (company directory and detail, admin): tables,
 * side-by-side panels and filter rows, which `max-w-6xl` left cramped. Reading
 * pages keep the narrow shell, and prose inside a wide page still caps at
 * `max-w-prose` — widening the measure would make a lesson worse, not better
 * (see `DESIGN.md`, "keep measures under 70 characters").
 */
export function Page({
  children,
  wide = false,
  callbackURL = "/home",
}: {
  children: React.ReactNode;
  wide?: boolean;
  callbackURL?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader callbackURL={callbackURL} />
      <main
        className={
          wide
            ? "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10"
            : "mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10"
        }
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
