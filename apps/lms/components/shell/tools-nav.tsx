"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/sidebar";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  Building2,
  FileCheck2,
  GraduationCap,
  Inbox,
  PenSquare,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

export type NavGroup = {
  label: string;
  items: {
    href: string;
    label: string;
    icon: keyof typeof icons;
    badge?: number;
  }[];
};

/**
 * Icons are named by the server and resolved here: a `LucideIcon` is a function
 * and cannot cross the server/client boundary as a prop.
 */
const icons = {
  account: UserCog,
  badges: Award,
  certificates: FileCheck2,
  companies: Building2,
  courses: BookOpen,
  mentor: GraduationCap,
  moderate: ShieldCheck,
  notifications: Inbox,
  studio: PenSquare,
} satisfies Record<string, LucideIcon>;

/** Marks the current item. `usePathname` is the only reason this is a client component. */
export function ToolsNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const Icon = icons[item.icon];
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.label}
                  >
                    <Link href={item.href as Route}>
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge ? (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
