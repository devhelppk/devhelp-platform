"use client";

import * as React from "react";
import { PanelLeftIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";

/**
 * Puts the sidebar behind a button below `lg`. Render it in the app-shell
 * header and pass the same `SidebarNav` you gave the shell.
 */
function MobileNav({
  title = "Navigation",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Open ${title.toLowerCase()}`}
          className={cn("lg:hidden", className)}
          {...props}
        >
          <PanelLeftIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Pages in this section.</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export { MobileNav };
