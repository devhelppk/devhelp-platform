import {
  BookOpen,
  Code2,
  ExternalLink,
  FolderGit2,
  ListChecks,
  PlayCircle,
} from "lucide-react";
import type { ComponentProps } from "react";

const icons = {
  article: BookOpen,
  video: PlayCircle,
  exercise: Code2,
  quiz: ListChecks,
  project: FolderGit2,
  link: ExternalLink,
} as const;

export type LessonType = keyof typeof icons;

export function LessonTypeIcon({
  type,
  ...props
}: { type: LessonType } & ComponentProps<"svg">) {
  const Icon = icons[type];
  return <Icon aria-hidden="true" {...props} />;
}

export const lessonTypeLabel: Record<LessonType, string> = {
  article: "Read",
  video: "Watch",
  exercise: "Exercise",
  quiz: "Quiz",
  project: "Project",
  link: "Link",
};
