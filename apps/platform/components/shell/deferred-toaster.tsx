"use client";

import dynamic from "next/dynamic";

// Loaded after hydration so notifications never sit in the first-load JS.
const Toaster = dynamic(
  () => import("@repo/ui/components/sonner").then((m) => m.Toaster),
  { ssr: false },
);

export function DeferredToaster() {
  return <Toaster />;
}
