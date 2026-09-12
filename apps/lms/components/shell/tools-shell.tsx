import { auth } from "@repo/auth";
import { unreadCount } from "@repo/notify";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { BrandMark } from "@repo/ui/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { ToolsNav, type NavGroup } from "./tools-nav";

/**
 * The shell for the signed-in tools: account, notifications, certificates,
 * studio, moderation, mentor and admin.
 *
 * Public pages keep `SiteHeader` (S16 D2). A 16rem nav rail on an indexable page
 * spends on navigation the width S15 widened those pages to gain, for a visitor
 * who arrived from a search result to read one thing. The lesson reader keeps its
 * own sidebar of module headings.
 *
 * Groups are decided here, on the server, from the role `auth` reports — never
 * from a client-side guess. A stale client role would advertise `/admin` in the
 * rail to someone who cannot open it.
 */
export async function ToolsShell({
  children,
  callbackURL,
}: {
  children: React.ReactNode;
  callbackURL: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user.role;
  const unread = session ? await unreadCount(session.user.id) : 0;

  const groups: NavGroup[] = [
    {
      label: "Learning",
      items: [
        { href: "/courses", label: "Courses", icon: "courses" },
        {
          href: "/certificates",
          label: "Certificates",
          icon: "certificates",
        },
        { href: "/badges", label: "Badges", icon: "badges" },
        {
          href: "/notifications",
          label: "Notifications",
          icon: "notifications",
          badge: unread,
        },
      ],
    },
  ];
  if (role === "mentor" || role === "admin")
    groups.push({
      label: "Contributing",
      items: [
        { href: "/studio", label: "Studio", icon: "studio" },
        { href: "/moderate", label: "Moderation", icon: "moderate" },
      ],
    });
  else
    groups.push({
      label: "Contributing",
      items: [
        { href: "/mentor/apply", label: "Become a mentor", icon: "mentor" },
      ],
    });
  if (role === "admin")
    groups.push({
      label: "Admin",
      items: [
        { href: "/admin/companies", label: "Companies", icon: "companies" },
        { href: "/admin/badges", label: "Badges", icon: "badges" },
        {
          href: "/admin/certificates",
          label: "Certificates",
          icon: "certificates",
        },
      ],
    });
  groups.push({
    label: "You",
    items: [{ href: "/account", label: "Account", icon: "account" }],
  });

  // The component writes this cookie itself; reading it here is what makes a
  // collapsed rail survive a reload without a flash of the open state.
  const collapsed = (await cookies()).get("sidebar_state")?.value === "false";

  return (
    <SidebarProvider defaultOpen={!collapsed}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* The wordmark truncates to a single letter in the collapsed rail, so
              the mark stands in for it. Swapped in CSS off the group's data
              attribute rather than in JS, so it costs no client state. */}
          <Link
            href="/"
            aria-label="devhelp home"
            className="flex items-center rounded-sm px-2 py-1 outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <BrandLogo
              product="Learn"
              className="group-data-[collapsible=icon]:hidden"
            />
            <BrandMark
              size={22}
              className="hidden group-data-[collapsible=icon]:block"
            />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <ToolsNav groups={groups} />
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
            <AccountMenu callbackURL={callbackURL} />
            <ThemeToggle />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
