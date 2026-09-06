"use client";

import { Button } from "@repo/ui/components/button";
import { PanelLeftIcon } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// The Sheet (Radix Dialog) only matters below `lg`; load it after hydration.
const MobileNav = dynamic(
  () => import("@repo/ui/components/mobile-nav").then((m) => m.MobileNav),
  {
    ssr: false,
    loading: () => (
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open lessons"
        disabled
      >
        <PanelLeftIcon aria-hidden="true" />
      </Button>
    ),
  },
);

export function LazyMobileNav({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return <MobileNav title={title}>{children}</MobileNav>;
}
