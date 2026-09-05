import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@repo/ui/lib/utils";

/**
 * Grouped navigation for the app-shell sidebar (and the mobile drawer).
 * Groups have a heading; items are links. The active item carries a 2px
 * rail on the left and `aria-current="page"`. Server-safe.
 */
function SidebarNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar-nav"
      className={cn("flex flex-col gap-6 px-4 py-6", className)}
      {...props}
    />
  );
}

function SidebarNavGroup({
  title,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { title: React.ReactNode }) {
  const id = React.useId();
  return (
    <div
      data-slot="sidebar-nav-group"
      role="group"
      aria-labelledby={id}
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      <p id={id} className="px-2 pb-1 text-sm font-semibold text-foreground">
        {title}
      </p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function SidebarNavItem({
  active = false,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"a"> & { active?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <li data-slot="sidebar-nav-item">
      <Comp
        aria-current={active ? "page" : undefined}
        data-active={active || undefined}
        className={cn(
          "block border-l-2 border-l-transparent py-1.5 pr-2 pl-4 text-sm text-muted-foreground outline-none",
          "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "data-active:border-l-primary data-active:font-medium data-active:text-foreground",
          className,
        )}
        {...props}
      />
    </li>
  );
}

export { SidebarNav, SidebarNavGroup, SidebarNavItem };
