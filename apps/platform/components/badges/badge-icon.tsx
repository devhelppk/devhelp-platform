import { icons } from "lucide-react";
import { Award } from "lucide-react";
import type { ComponentProps } from "react";

/**
 * lucide by kebab-case name, validated at content-check time; Award if a name
 * ever slips through. Server components only: the dynamic lookup keeps the
 * whole icon map, so importing this from a client component would ship about a
 * megabyte of JS. Client code renders an icon passed in as a node instead.
 */
export function BadgeIcon({
  name,
  ...props
}: { name: string } & ComponentProps<"svg">) {
  const pascal = name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const Icon = (icons as Record<string, typeof Award>)[pascal] ?? Award;
  return <Icon aria-hidden="true" {...props} />;
}
