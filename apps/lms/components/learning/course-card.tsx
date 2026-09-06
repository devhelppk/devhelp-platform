import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Clock, Layers } from "lucide-react";
import Link from "next/link";

export type CourseCardProps = {
  slug: string;
  title: string;
  summary: string;
  track: "technical" | "career";
  level: "beginner" | "intermediate" | "advanced";
  lessonCount?: number;
  durationMinutes: number;
  progressPercent?: number | null;
  status?: "active" | "completed" | "dropped" | null;
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function CourseCard(c: CourseCardProps) {
  return (
    <Link
      href={`/courses/${c.slug}`}
      className="group block h-full rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:border-foreground/30">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {c.track === "technical" ? "Technical" : "Career"}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {c.level}
            </Badge>
            {c.status === "completed" ? <Badge>Completed</Badge> : null}
          </div>
          <CardTitle className="font-display text-xl">{c.title}</CardTitle>
          <CardDescription>{c.summary}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto flex flex-col gap-3">
          <dl className="flex gap-4 text-sm text-muted-foreground">
            {typeof c.lessonCount === "number" && c.lessonCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <Layers className="size-4" aria-hidden="true" />
                <dt className="sr-only">Lessons</dt>
                <dd>
                  {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              <dt className="sr-only">Duration</dt>
              <dd>{formatDuration(c.durationMinutes)}</dd>
            </div>
          </dl>
          {typeof c.progressPercent === "number" && c.status ? (
            <ProgressBar
              value={c.progressPercent}
              label={`${c.progressPercent}% complete`}
            />
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}
