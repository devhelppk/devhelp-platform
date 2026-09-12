import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@repo/ui/components/sidebar";
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
    <nav aria-label="Guide" className="flex flex-col gap-2 py-2">
      {GROUPS.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              <SidebarMenuItem key={item}>
                <SidebarMenuButton asChild isActive={item === ACTIVE}>
                  <Link href="#shell">{item}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}

function OnThisPage() {
  return (
    <nav aria-label="On this page" className="flex flex-col gap-2 text-sm">
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

/**
 * The shell's vocabulary at a fixed height, so it reads as a component rather
 * than a page.
 *
 * This shows the parts — the grouped rail, the header with its breadcrumb and
 * actions, the reading measure, the "on this page" aside — rather than mounting
 * `Sidebar` itself. That is deliberate and it is a property of the component,
 * not a shortcut: shadcn's `Sidebar` positions its rail `fixed inset-y-0 h-svh`
 * against the viewport, so it cannot be boxed inside a 36rem frame without
 * fighting it. `SidebarProvider` is still here, because `SidebarMenuButton` and
 * `SidebarGroupLabel` read its context; its own `min-h-svh` is overridden for
 * the same reason.
 *
 * The whole shell, assembled, is every signed-in page of the LMS and every
 * lesson: open a lesson to see it working.
 */
export function ShellDemo() {
  return (
    <div className="h-[36rem] overflow-hidden rounded-lg border">
      <SidebarProvider className="h-full min-h-0">
        <div className="grid h-full min-h-0 w-full grid-cols-1 overflow-y-auto lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden border-r bg-sidebar px-2 text-sidebar-foreground lg:block">
            <Nav />
          </aside>
          <div className="flex min-w-0 flex-col">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
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
            </header>
            <div className="flex min-w-0 flex-1 xl:grid xl:grid-cols-[minmax(0,1fr)_14rem]">
              <main className="mx-auto w-full max-w-4xl min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
                <article className="prose-lesson">
                  <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">
                    Set up your machine
                  </h1>
                  <p className="font-sans text-lg text-muted-foreground">
                    About 20 minutes. You need a laptop with 8 GB of RAM and a
                    stable connection for the first install.
                  </p>
                  <h2>Install Node</h2>
                  <p>
                    Install the current LTS release from nodejs.org. On Windows
                    use the installer; on Ubuntu use <code>nvm</code> so you can
                    switch versions later without reinstalling.
                  </p>
                  <h2>Install pnpm</h2>
                  <p>
                    We use pnpm because it is fast on slow connections: packages
                    are downloaded once and linked into every project.
                  </p>
                  <pre>
                    <code>{`corepack enable\ncorepack prepare pnpm@latest --activate`}</code>
                  </pre>
                  <ol>
                    <li>
                      <strong>Check the version.</strong> Run{" "}
                      <code>pnpm -v</code>; you should see 10 or newer.
                    </li>
                    <li>
                      <strong>Set a store path.</strong> Keep it on your fastest
                      disk.
                    </li>
                  </ol>
                  <blockquote>
                    If an install fails halfway on mobile data, run it again;
                    pnpm resumes from the store instead of starting over.
                  </blockquote>
                </article>
              </main>
              <aside className="hidden border-l px-5 py-6 xl:block">
                <div className="sticky top-6">
                  <OnThisPage />
                </div>
              </aside>
            </div>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}
