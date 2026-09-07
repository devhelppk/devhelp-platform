import { and, db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let mentor: User, learner: User, author: User;
let courseId: string, lessonId: string, moduleId: string;
const slug = `studio-${run}`;
const made: string[] = [];

const as = (u: User | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({ user: u, session: { id: "s" } } as unknown as Context["session"])
      : null,
  } as Context);

async function user(name: string, role?: "mentor" | "admin") {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${name}-${run}@devhelp.test`,
      name,
      emailVerified: true,
      ...(role ? { role } : {}),
    })
    .returning();
  made.push(u!.id);
  return u!;
}

beforeAll(async () => {
  mentor = await user("studio-mentor", "mentor");
  learner = await user("studio-learner");
  author = await user("studio-author");
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug,
      // The state the sync leaves behind: a placeholder nobody has described.
      title: slug,
      summary: "",
      needsMetadata: true,
      isPublished: false,
    })
    .returning();
  courseId = course!.id;
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId, slug: "m1", title: "m1", position: 1 })
    .returning();
  moduleId = mod!.id;
  const [lesson] = await db
    .insert(schema.lessons)
    .values({
      courseId,
      moduleId,
      slug: "l1",
      title: "l1",
      needsMetadata: true,
      position: 1,
    })
    .returning();
  lessonId = lesson!.id;
});

afterAll(async () => {
  await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
  for (const id of made)
    await db.delete(schema.users).where(eq(schema.users.id, id));
});

describe("editing metadata", () => {
  it("refuses to publish a course nobody has described", async () => {
    await expect(
      as(mentor).studio.updateCourse({ slug, isPublished: true }),
    ).rejects.toThrow(/title and summary/i);
    const row = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
    });
    expect(row!.isPublished).toBe(false);
  });

  it("clears needsMetadata once it is described, and records the change", async () => {
    const r = await as(mentor).studio.updateCourse({
      slug,
      title: "A properly titled course",
      summary: "A summary long enough to say what this course is actually for.",
      level: "intermediate",
    });
    expect(r.changed).toBe(3);
    const row = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
    });
    expect(row!.needsMetadata).toBe(false);
    expect(row!.title).toBe("A properly titled course");
    const edits = await db.query.contentEdits.findMany({
      where: and(
        eq(schema.contentEdits.subjectType, "course"),
        eq(schema.contentEdits.subjectId, courseId),
      ),
    });
    expect(edits).toHaveLength(1);
    const changes = edits[0]!.changes;
    expect(changes.map((c) => c.field).sort()).toEqual([
      "level",
      "summary",
      "title",
    ]);
    const title = changes.find((c) => c.field === "title")!;
    expect(title.before).toBe(slug);
    expect(title.after).toBe("A properly titled course");
    expect(edits[0]!.actorId).toBe(mentor.id);
  });

  it("counts a summary, not a changed title, as having been described", async () => {
    // A mentor may keep the slug's wording as the title. Blocking publication
    // for that would be baffling; the summary is what the sync never writes.
    const [c] = await db
      .insert(schema.courses)
      .values({
        slug: `${slug}-kept`,
        title: `${slug}-kept`,
        summary: "",
        needsMetadata: true,
      })
      .returning();
    await as(mentor).studio.updateCourse({
      slug: `${slug}-kept`,
      summary: "A summary a person wrote, while keeping the slug as the title.",
    });
    const row = await db.query.courses.findFirst({
      where: eq(schema.courses.id, c!.id),
    });
    expect(row!.needsMetadata).toBe(false);
    await as(mentor).studio.updateCourse({
      slug: `${slug}-kept`,
      isPublished: true,
    });
    const published = await db.query.courses.findFirst({
      where: eq(schema.courses.id, c!.id),
    });
    expect(published!.isPublished).toBe(true);
    await db.delete(schema.courses).where(eq(schema.courses.id, c!.id));
  });

  it("publishes once it is described", async () => {
    await as(mentor).studio.updateCourse({ slug, isPublished: true });
    const row = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
    });
    expect(row!.isPublished).toBe(true);
    expect(row!.publishedAt).toBeInstanceOf(Date);
  });

  it("records nothing when nothing changed", async () => {
    const before = await db.query.contentEdits.findMany({
      where: eq(schema.contentEdits.subjectId, courseId),
    });
    const r = await as(mentor).studio.updateCourse({
      slug,
      title: "A properly titled course",
    });
    expect(r.changed).toBe(0);
    const after = await db.query.contentEdits.findMany({
      where: eq(schema.contentEdits.subjectId, courseId),
    });
    expect(after).toHaveLength(before.length);
  });

  it("keeps a long description out of the way of the save", async () => {
    // The trail entry is capped; the description is not. Parsing the trail
    // inside the transaction meant a long description rolled the save back.
    const long = "x".repeat(3500);
    await as(mentor).studio.updateCourse({ slug, description: long });
    const row = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
    });
    expect(row!.description).toBe(long);
    const edits = await db.query.contentEdits.findMany({
      where: and(
        eq(schema.contentEdits.subjectType, "course"),
        eq(schema.contentEdits.subjectId, courseId),
      ),
    });
    const entry = edits
      .flatMap((e) => e.changes)
      .find((c) => c.field === "description");
    expect(entry).toBeDefined();
    expect(entry!.after!.length).toBeLessThanOrEqual(2000);
  });

  it("edits a lesson and a module", async () => {
    await as(mentor).studio.updateLesson({
      id: lessonId,
      title: "A lesson with a real title",
      durationMinutes: 12,
    });
    const lesson = await db.query.lessons.findFirst({
      where: eq(schema.lessons.id, lessonId),
    });
    expect(lesson!.title).toBe("A lesson with a real title");
    expect(lesson!.durationMinutes).toBe(12);
    expect(lesson!.needsMetadata).toBe(false);
    await as(mentor).studio.updateModule({ id: moduleId, title: "Module one" });
    const mod = await db.query.modules.findFirst({
      where: eq(schema.modules.id, moduleId),
    });
    expect(mod!.title).toBe("Module one");
  });

  it("is closed to learners", async () => {
    await expect(
      as(learner).studio.updateCourse({ slug, title: "Nope at all" }),
    ).rejects.toThrow(/Mentors only/);
    await expect(as(learner).studio.overview()).rejects.toThrow(/Mentors only/);
    await expect(as(null).studio.overview()).rejects.toThrow(/Sign in/);
  });
});

describe("credits", () => {
  it("credits a user and renders as a byline", async () => {
    await as(mentor).studio.setCredits({
      subjectType: "lesson",
      subjectId: lessonId,
      role: "author",
      userIds: [author.id],
    });
    const byline = await as(null).contributors.forLesson({ lessonId });
    expect(byline).toHaveLength(1);
    expect(byline[0]!.name).toBe(author.name);
    expect(byline[0]!.role).toBe("author");
  });

  it("takes the same person twice as one credit", async () => {
    // The search list can offer somebody already credited; sending them twice
    // must not break the unique index.
    await as(mentor).studio.setCredits({
      subjectType: "lesson",
      subjectId: lessonId,
      role: "author",
      userIds: [author.id, author.id],
    });
    const byline = await as(null).contributors.forLesson({ lessonId });
    expect(byline.filter((b) => b.role === "author")).toHaveLength(1);
  });

  it("refuses somebody without an account", async () => {
    await expect(
      as(mentor).studio.setCredits({
        subjectType: "lesson",
        subjectId: lessonId,
        role: "author",
        userIds: [crypto.randomUUID()],
      }),
    ).rejects.toThrow(/does not have a devhelp account/);
  });

  it("replaces the set for a role and leaves other roles alone", async () => {
    const second = await user("studio-second");
    await as(mentor).studio.setCredits({
      subjectType: "lesson",
      subjectId: lessonId,
      role: "reviewer",
      userIds: [second.id],
    });
    await as(mentor).studio.setCredits({
      subjectType: "lesson",
      subjectId: lessonId,
      role: "author",
      userIds: [],
    });
    const byline = await as(null).contributors.forLesson({ lessonId });
    expect(byline.map((b) => b.role)).toEqual(["reviewer"]);
  });

  it("lists contributors with what they worked on", async () => {
    await as(mentor).studio.setCredits({
      subjectType: "course",
      subjectId: courseId,
      role: "author",
      userIds: [author.id],
    });
    const list = await as(null).contributors.list();
    const entry = list.find((p) => p.userId === author.id);
    expect(entry).toBeDefined();
    expect(entry!.courses.map((c) => c.slug)).toContain(slug);
  });

  it("records a credit change in the trail", async () => {
    const edits = await db.query.contentEdits.findMany({
      where: and(
        eq(schema.contentEdits.subjectType, "course"),
        eq(schema.contentEdits.subjectId, courseId),
      ),
    });
    expect(
      edits.some((e) => e.changes.some((c) => c.field === "authors")),
    ).toBe(true);
  });
});

describe("the studio overview", () => {
  it("leads with what needs describing and what the signals flag", async () => {
    const [flagged] = await db
      .insert(schema.lessons)
      .values({
        courseId,
        moduleId,
        slug: "l2",
        title: "A lesson readers found unclear",
        position: 2,
        unclearCount: 5,
        ratingCount: 4,
        ratingAvg: "2.50",
      })
      .returning();
    const overview = await as(mentor).studio.overview();
    expect(overview.flagged.some((l) => l.id === flagged!.id)).toBe(true);
    expect(overview.recent.length).toBeGreaterThan(0);
    await db.delete(schema.lessons).where(eq(schema.lessons.id, flagged!.id));
  });
});
