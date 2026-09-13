import { Button } from "@repo/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export type LessonNavItem = { slug: string; title: string } | null;

export function LessonNav({
  courseSlug,
  prev,
  next,
}: {
  courseSlug: string;
  prev: LessonNavItem;
  next: LessonNavItem;
}) {
  return (
    <nav
      aria-label="Lesson navigation"
      className="flex items-center justify-between gap-3 border-t pt-6"
    >
      {prev ? (
        <Button variant="outline" asChild>
          <Link href={`/courses/${courseSlug}/${prev.slug}`}>
            <ChevronLeft aria-hidden="true" />{" "}
            <span className="max-w-[16ch] truncate">{prev.title}</span>
          </Link>
        </Button>
      ) : (
        <span />
      )}
      {next ? (
        <Button variant="outline" asChild>
          <Link href={`/courses/${courseSlug}/${next.slug}`}>
            <span className="max-w-[16ch] truncate">{next.title}</span>{" "}
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <Link href={`/courses/${courseSlug}`}>Back to course</Link>
        </Button>
      )}
    </nav>
  );
}

/** Prev/next around the flat, ordered lesson list. */
export function neighbours<T extends { slug: string; title: string }>(
  lessons: T[],
  currentSlug: string,
): { prev: T | null; next: T | null } {
  const i = lessons.findIndex((l) => l.slug === currentSlug);
  return {
    prev: i > 0 ? lessons[i - 1]! : null,
    next: i >= 0 && i < lessons.length - 1 ? lessons[i + 1]! : null,
  };
}
