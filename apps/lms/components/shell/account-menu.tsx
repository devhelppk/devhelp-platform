import type { Route } from "next";
import { auth } from "@repo/auth";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * Server-rendered account menu: no auth client or dropdown JS on every page.
 * `<details>` gives an accessible disclosure; sign-out is a server action.
 */
export async function AccountMenu({
  callbackURL = "/",
}: {
  callbackURL?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return (
      <Button size="sm" asChild>
        <Link
          href={
            `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}` as Route
          }
        >
          Sign in
        </Link>
      </Button>
    );
  }
  const initials = session.user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function signOut() {
    "use server";
    await auth.api.signOut({ headers: await headers() });
    redirect("/");
  }

  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
        </Avatar>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        <div className="flex flex-col px-2 py-1.5 text-sm">
          <span className="truncate font-medium">{session.user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {session.user.email}
          </span>
        </div>
        <div className="my-1 h-px bg-border" />
        <Link
          href="/"
          className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          Dashboard
        </Link>
        <Link
          href="/courses"
          className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          Courses
        </Link>
        <Link
          href="/notifications"
          className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          Notifications
        </Link>
        <Link
          href="/certificates"
          className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          Certificates
        </Link>
        <Link
          href="/account"
          className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          Account
        </Link>
        {session.user.role === "mentor" || session.user.role === "admin" ? (
          <Link
            href="/moderate"
            className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            Moderation
          </Link>
        ) : null}
        {session.user.role === "admin" ? (
          <Link
            href="/admin/certificates"
            className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            Admin
          </Link>
        ) : null}
        <div className="my-1 h-px bg-border" />
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
