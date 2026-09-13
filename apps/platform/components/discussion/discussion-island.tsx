"use client";

import dynamic from "next/dynamic";

/** Loaded after hydration so the lesson body never waits for it (N4.1) and its text is not in the server HTML (N4.3). */
export const DiscussionIsland = dynamic(
  () => import("./discussion").then((m) => m.Discussion),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Loading discussion…</p>
    ),
  },
);
