import { and, eq, isNull, schema } from "@repo/database";
import { TRPCError } from "@trpc/server";

type Db = typeof import("@repo/database").db;

/** Published course by slug, with the fields area 4 needs. */
export async function courseBySlug(db: Db, courseSlug: string) {
  const course = await db.query.courses.findFirst({
    where: and(
      eq(schema.courses.slug, courseSlug),
      eq(schema.courses.isPublished, true),
      isNull(schema.courses.archivedAt),
    ),
    columns: { id: true, slug: true, title: true, track: true },
  });
  if (!course)
    throw new TRPCError({ code: "NOT_FOUND", message: "Course not found." });
  return course;
}

/** Live lesson by slug inside a course. */
export async function lessonBySlug(
  db: Db,
  courseId: string,
  lessonSlug: string,
) {
  const lesson = await db.query.lessons.findFirst({
    where: and(
      eq(schema.lessons.courseId, courseId),
      eq(schema.lessons.slug, lessonSlug),
      isNull(schema.lessons.archivedAt),
    ),
    columns: { id: true, slug: true, title: true },
  });
  if (!lesson)
    throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found." });
  return lesson;
}

/** A discussion subject: a lesson (courseSlug + lessonSlug) or a course (courseSlug only). */
export async function subjectBySlugs(
  db: Db,
  input: { courseSlug: string; lessonSlug?: string },
) {
  const course = await courseBySlug(db, input.courseSlug);
  if (input.lessonSlug) {
    const lesson = await lessonBySlug(db, course.id, input.lessonSlug);
    return {
      course,
      subjectType: "lesson" as const,
      subjectId: lesson.id,
      subjectSlug: lesson.slug,
      subjectTitle: lesson.title,
    };
  }
  return {
    course,
    subjectType: "course" as const,
    subjectId: course.id,
    subjectSlug: course.slug,
    subjectTitle: course.title,
  };
}
