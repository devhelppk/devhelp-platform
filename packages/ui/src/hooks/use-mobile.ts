/**
 * shadcn/ui `use-mobile`, pulled with the sidebar.
 *
 * Rewritten onto `useSyncExternalStore`. The registry version sets state
 * synchronously inside an effect, which this repo's lint rejects (it can trigger
 * cascading renders) and which also renders one frame with the wrong answer.
 * `useSyncExternalStore` reads the match at render time and takes a server
 * snapshot, so SSR gets the desktop layout rather than a hydration mismatch.
 */
import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
