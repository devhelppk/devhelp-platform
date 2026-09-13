"use client";

import dynamic from "next/dynamic";

// Runners and editors are heavy; load them only on quiz and exercise lessons, after hydration.
const Quiz = dynamic(() => import("./quiz").then((m) => m.Quiz), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading quiz…</p>,
});
const Exercise = dynamic(() => import("./exercise").then((m) => m.Exercise), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-muted-foreground">Loading exercise…</p>
  ),
});

export function Assessment(props: {
  type: "quiz" | "exercise";
  courseSlug: string;
  lessonSlug: string;
  signedIn: boolean;
  completed: boolean;
}) {
  return props.type === "quiz" ? <Quiz {...props} /> : <Exercise {...props} />;
}
