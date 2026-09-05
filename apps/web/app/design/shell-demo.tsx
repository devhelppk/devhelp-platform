import Link from "next/link";
import {
  AppShell,
  AppShellContent,
  AppShellHeader,
} from "@repo/ui/components/app-shell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import { MobileNav } from "@repo/ui/components/mobile-nav";
import {
  SidebarNav,
  SidebarNavGroup,
  SidebarNavItem,
} from "@repo/ui/components/sidebar-nav";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";

const GROUPS = [
  {
    title: "Getting started",
    items: [
      "Why this guide exists",
      "Set up your machine",
      "Your first commit",
    ],
  },
  {
    title: "Working in a team",
    items: [
      "Writing a pull request",
      "Reviewing someone else's code",
      "Disagreeing well",
    ],
  },
  {
    title: "Going further",
    items: ["Reading the docs", "Asking for help", "Where next"],
  },
];

const ACTIVE = "Set up your machine";

function Nav() {
  return (
    <SidebarNav aria-label="Guide">
      {GROUPS.map((group) => (
        <SidebarNavGroup key={group.title} title={group.title}>
          {group.items.map((item) => (
            <SidebarNavItem key={item} asChild active={item === ACTIVE}>
              <Link href="#shell">{item}</Link>
            </SidebarNavItem>
          ))}
        </SidebarNavGroup>
      ))}
    </SidebarNav>
  );
}

function OnThisPage() {
  return (
    <nav aria-label="On this page" className="flex flex-col gap-2">
      <p className="font-medium text-foreground">On this page</p>
      <ul className="flex flex-col border-l">
        {[
          "Install Node",
          "Install pnpm",
          "Clone the repository",
          "Check it runs",
        ].map((h, i) => (
          <li key={h}>
            <Link
              href="#shell"
              aria-current={i === 1 ? "location" : undefined}
              className="-ml-px block border-l-2 border-l-transparent py-1 pl-3 text-muted-foreground hover:text-foreground aria-[current]:border-l-primary aria-[current]:text-foreground"
            >
              {h}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The app shell at a fixed height so it reads as a component, not a page. */
export function ShellDemo() {
  return (
    <div className="h-[36rem] overflow-hidden rounded-lg border">
      <AppShell
        sidebar={<Nav />}
        aside={<OnThisPage />}
        className="h-full min-h-0 overflow-y-auto"
      >
        <AppShellHeader>
          <MobileNav title="Guide">
            <Nav />
          </MobileNav>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Link href="#shell">Guides</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Link href="#shell">Getting started</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              <BreadcrumbItem>
                <BreadcrumbPage>Set up your machine</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button size="sm" variant="outline">
              Mark as done
            </Button>
          </div>
        </AppShellHeader>
        <AppShellContent>
          <article className="prose-lesson">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">
              Set up your machine
            </h1>
            <p className="font-sans text-lg text-muted-foreground">
              About 20 minutes. You need a laptop with 8 GB of RAM and a stable
              connection for the first install.
            </p>
            <h2>Install Node</h2>
            <p>
              Install the current LTS release from nodejs.org. On Windows use
              the installer; on Ubuntu use <code>nvm</code> so you can switch
              versions later without reinstalling.
            </p>
            <h2>Install pnpm</h2>
            <p>
              We use pnpm because it is fast on slow connections: packages are
              downloaded once and linked into every project.
            </p>
            <pre>
              <code>{`corepack enable\ncorepack prepare pnpm@latest --activate`}</code>
            </pre>
            <ol>
              <li>
                <strong>Check the version.</strong> Run <code>pnpm -v</code>;
                you should see 10 or newer.
              </li>
              <li>
                <strong>Set a store path.</strong> Keep it on your fastest disk.
              </li>
            </ol>
            <blockquote>
              If an install fails halfway on mobile data, run it again; pnpm
              resumes from the store instead of starting over.
            </blockquote>
          </article>
        </AppShellContent>
      </AppShell>
    </div>
  );
}
