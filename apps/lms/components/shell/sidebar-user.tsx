"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui/components/sidebar";
import { ChevronsUpDown, LogOut, UserCog } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

/**
 * Who is signed in, at the foot of the rail: avatar, name, email, and the way out.
 *
 * The header's `AccountMenu` is a `<details>` popover anchored `right-0 mt-2`,
 * which is fine under a top bar and wrong here — at the bottom of the rail it
 * opened downwards, off the viewport, so the name, email and Sign out were all
 * present in the markup and impossible to reach. This opens upward (`side="top"`)
 * and, collapsed to the icon rail, to the right.
 *
 * Signing out is the server action passed in as `signOut`; nothing about the
 * session is decided in the browser.
 */
export function SidebarUser({
  name,
  email,
  signOut,
}: {
  name: string;
  email: string;
  signOut: () => Promise<void>;
}) {
  const { state, isMobile } = useSidebar();
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={name}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : state === "collapsed" ? "right" : "top"}
            align="end"
            sideOffset={4}
          >
            <div className="flex flex-col px-2 py-1.5 text-sm">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={"/account" as Route}>
                  <UserCog aria-hidden="true" />
                  Account
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void signOut();
              }}
            >
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
