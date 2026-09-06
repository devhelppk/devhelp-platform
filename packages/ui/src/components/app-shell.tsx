import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

/**
 * Three-column reading shell: a sticky left sidebar (navigation), a top bar
 * (breadcrumbs and actions), the content column, and an optional right aside
 * ("On this page"). Server-safe; compose with `SidebarNav` and `MobileNav`.
 *
 * <AppShell sidebar={<SidebarNav … />} aside={<Toc />}>
 *   <AppShellHeader>…</AppShellHeader>
 *   <AppShellContent>…</AppShellContent>
 * </AppShell>
 */
function AppShell({
  sidebar,
  aside,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  sidebar?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div
      data-slot="app-shell"
      className={cn(
        "grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]",
        className,
      )}
      {...props}
    >
      {sidebar ? (
        <aside
          data-slot="app-shell-sidebar"
          className="sticky top-0 hidden max-h-dvh overflow-y-auto border-r bg-sidebar text-sidebar-foreground lg:block"
        >
          {sidebar}
        </aside>
      ) : null}
      <div
        data-slot="app-shell-body"
        className={cn(
          "flex min-w-0 flex-col",
          aside &&
            "xl:grid xl:grid-cols-[minmax(0,1fr)_14rem] xl:grid-rows-[auto_1fr]",
        )}
      >
        {children}
        {aside ? (
          <aside
            data-slot="app-shell-aside"
            className="hidden border-l px-5 py-6 text-sm xl:row-start-2 xl:block"
          >
            <div className="sticky top-6">{aside}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** Top bar: breadcrumbs on the left, actions (theme toggle, account) on the right. */
function AppShellHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="app-shell-header"
      className={cn(
        "sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 xl:col-span-2",
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}

/** The reading column. Caps the measure and sets the section rhythm. */
function AppShellContent({
  className,
  children,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="app-shell-content"
      className={cn(
        "mx-auto w-full max-w-4xl min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:row-start-2",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}

export { AppShell, AppShellHeader, AppShellContent };
