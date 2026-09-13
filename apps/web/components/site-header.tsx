import Link from "next/link";
import type { Route } from "next";
import { clientEnv } from "@repo/env/client";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Button } from "@repo/ui/components/button";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";

/** The marketing pages; the LMS lives on its own domain. */
const NAV: { href: Route; label: string }[] = [
  { href: "/about", label: "About" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/contribute", label: "Contribute" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandLogo />
        </Link>
        <nav
          aria-label="Main"
          className="flex items-center gap-0.5 sm:gap-1"
          /* The links collapse before the action does: on a phone the one thing
             worth tapping is "Start learning", and a row of five ghost buttons
             would push it off the screen. The pages themselves are all reachable
             from the footer, which is why hiding them here costs nothing. */
        >
          {NAV.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              asChild
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          <ThemeToggle />
          <Button size="sm" asChild>
            <a href={`${clientEnv.NEXT_PUBLIC_LMS_URL}/courses`}>
              Start learning
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

const LEARN: { href: string; label: string }[] = [
  { href: `${clientEnv.NEXT_PUBLIC_LMS_URL}/courses`, label: "Courses" },
  { href: `${clientEnv.NEXT_PUBLIC_LMS_URL}/companies`, label: "Companies" },
  { href: `${clientEnv.NEXT_PUBLIC_LMS_URL}/search`, label: "Search" },
];

const PROJECT: { href: Route; label: string }[] = [
  { href: "/about", label: "About" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/contribute", label: "Contribute" },
  { href: "/faq", label: "FAQ" },
];

const LEGAL: { href: Route; label: string }[] = [
  { href: "/policy", label: "Content policy" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <BrandLogo className="text-base" />
          <p className="text-sm text-muted-foreground">
            Free and open source, made in Pakistan. Code under MIT, curriculum
            under CC BY-SA 4.0.
          </p>
        </div>
        <FooterColumn title="Learn">
          {LEARN.map((l) => (
            <li key={l.href}>
              <a className="hover:text-foreground" href={l.href}>
                {l.label}
              </a>
            </li>
          ))}
        </FooterColumn>
        <FooterColumn title="Project">
          {PROJECT.map((l) => (
            <li key={l.href}>
              <Link className="hover:text-foreground" href={l.href}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              className="hover:text-foreground"
              href="https://github.com/devhelppk/devhelp-platform"
            >
              GitHub
            </a>
          </li>
        </FooterColumn>
        <FooterColumn title="Legal">
          {LEGAL.map((l) => (
            <li key={l.href}>
              <Link className="hover:text-foreground" href={l.href}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              className="hover:text-foreground"
              href="mailto:policy@devhelp.pk"
            >
              policy@devhelp.pk
            </a>
          </li>
        </FooterColumn>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{title}</p>
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {children}
      </ul>
    </div>
  );
}
