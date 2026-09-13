import type { Route } from "next";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import Link from "next/link";

const LEARN: { href: Route; label: string }[] = [
  { href: "/courses", label: "Courses" },
  { href: "/companies", label: "Companies" },
  { href: "/search", label: "Search" },
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

/**
 * Rendered by the marketing layout and by `Page` (the signed-out shell), not by
 * `ToolsShell`: the rail is the navigation there. Static — no session read — so
 * the `force-static` document pages can carry it.
 */
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
            <FooterLink key={l.href} href={l.href} label={l.label} />
          ))}
        </FooterColumn>
        <FooterColumn title="Project">
          {PROJECT.map((l) => (
            <FooterLink key={l.href} href={l.href} label={l.label} />
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
            <FooterLink key={l.href} href={l.href} label={l.label} />
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

function FooterLink({ href, label }: { href: Route; label: string }) {
  return (
    <li>
      <Link className="hover:text-foreground" href={href}>
        {label}
      </Link>
    </li>
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
