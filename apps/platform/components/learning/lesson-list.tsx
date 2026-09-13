import { cn } from "@repo/ui/lib/utils";
import { Check, Lock } from "lucide-react";
import Link from "next/link";
import {
  LessonTypeIcon,
  lessonTypeLabel,
  type LessonType,
} from "./lesson-type-icon";

export type LessonListItem = {
  slug: string;
  title: string;
  type: LessonType;
  durationMinutes: number | null;
  isRequired: boolean;
  status?: "not_started" | "in_progress" | "completed" | null;
};

export type LessonListModule = {
  slug: string;
  title: string;
  lessons: LessonListItem[];
};

/** Modules with their lessons, completion ticks, and the current lesson highlighted. */
export function LessonList({
  courseSlug,
  modules,
  currentSlug,
  compact = false,
}: {
  courseSlug: string;
  modules: LessonListModule[];
  currentSlug?: string;
  compact?: boolean;
}) {
  return (
    <nav aria-label="Lessons" className="flex flex-col gap-6">
      {modules.map((mod, i) => (
        <section key={mod.slug} className="flex flex-col gap-2">
          <h3 className={cn("font-medium", compact ? "text-sm" : "text-base")}>
            <span className="mr-2 text-muted-foreground">{i + 1}.</span>
            {mod.title}
          </h3>
          <ol className="flex flex-col">
            {mod.lessons.map((l) => {
              const current = l.slug === currentSlug;
              const done = l.status === "completed";
              return (
                <li key={l.slug}>
                  <Link
                    href={`/courses/${courseSlug}/${l.slug}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      current && "bg-accent font-medium",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground",
                      )}
                      aria-label={done ? "Completed" : undefined}
                    >
                      {done ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        <LessonTypeIcon type={l.type} className="size-3" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1",
                        compact ? "leading-snug" : "truncate",
                      )}
                    >
                      {l.title}
                    </span>
                    {compact ? null : (
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {lessonTypeLabel[l.type]}
                        {l.durationMinutes ? ` · ${l.durationMinutes} min` : ""}
                      </span>
                    )}
                    {!l.isRequired ? (
                      <Lock
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-label="Optional"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </nav>
  );
}
