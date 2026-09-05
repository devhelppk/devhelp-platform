"use client";

import * as React from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@repo/ui/components/button";

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["light", "dark", "system"];

const ICON: Record<Theme, React.ElementType> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

// Hydration guard: "false" on the server, "true" once the client renders.
function subscribeNoop() {
  return () => {};
}

function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * One button that cycles light → dark → system. The accessible name always
 * says what pressing it will do, so screen-reader users hear the outcome.
 */
function ThemeToggle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "children">) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  // Before hydration next-themes does not know the stored theme; render the
  // system state so the markup matches on the server and the client.
  const current: Theme = mounted && isTheme(theme) ? theme : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";
  const Icon = ICON[current];

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${next} theme`}
      title={`Theme: ${current}`}
      data-theme={current}
      onClick={() => setTheme(next)}
      className={className}
      {...props}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

export { ThemeToggle };
