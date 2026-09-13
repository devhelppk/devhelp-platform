import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import Link from "next/link";
import { ProgressBar } from "./course-card";

export function ContinueCard({
  courseSlug,
  courseTitle,
  lessonSlug,
  lessonTitle,
  progressPercent,
}: {
  courseSlug: string;
  courseTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  progressPercent: number;
}) {
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardDescription>Continue where you left off</CardDescription>
        <CardTitle className="font-display text-2xl">{courseTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ProgressBar
          value={progressPercent}
          label={`${progressPercent}% complete`}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Next: {lessonTitle}</p>
          <Button asChild>
            <Link href={`/courses/${courseSlug}/${lessonSlug}`}>Continue</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
