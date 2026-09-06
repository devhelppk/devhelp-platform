import { allLessons } from "content-collections";

export type CompiledLesson = (typeof allLessons)[number];

/** Resolve a compiled lesson body by the `content_path` stored on the lesson row. */
export function getCompiledLesson(
  contentPath: string,
): CompiledLesson | undefined {
  return allLessons.find((l) => l.contentPath === contentPath);
}

export { allLessons };
