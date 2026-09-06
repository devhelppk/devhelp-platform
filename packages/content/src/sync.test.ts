import {
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, db, eq, inArray, schema } from "@repo/database";
import { recordEvent } from "@repo/learning";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { syncContent } from "./sync";

/**
 * Integration tests against the local Postgres. Uses a private copy of the
 * content-schema "valid" fixture so it can be mutated between syncs, with
 * a run-specific course slug so it never collides with real content.
 */
const run = Date.now().toString(36);
const slug = `sync-${run}`;
const repo = `test/${run}`;
let dir: string;
const lessonFile = () => join(dir, "courses", slug, "01-m1", "02-check.mdx");
const quizFile = () => join(dir, "courses", slug, "quizzes", "q1.yaml");

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "devhelp-sync-"));
  const fixture = join(
    import.meta.dirname,
    "../../content-schema/test/fixtures/valid",
  );
  cpSync(fixture, dir, { recursive: true });
  cpSync(join(dir, "courses", "c1"), join(dir, "courses", slug), {
    recursive: true,
  });
  rmSync(join(dir, "courses", "c1"), { recursive: true });
  writeFileSync(
    join(dir, "courses", slug, "course.yaml"),
    readFileSync(join(dir, "courses", slug, "course.yaml"), "utf8").replace(
      "slug: c1",
      `slug: ${slug}`,
    ),
  );
  writeFileSync(
    join(dir, "paths", "p1.yaml"),
    readFileSync(join(dir, "paths", "p1.yaml"), "utf8")
      .replace("slug: p1", `slug: p-${run}`)
      .replace("courses: [c1]", `courses: [${slug}]`),
  );
});

afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await db.delete(schema.courses).where(eq(schema.courses.slug, slug));
  await db.delete(schema.paths).where(eq(schema.paths.slug, `p-${run}`));
  await db
    .delete(schema.users)
    .where(eq(schema.users.email, `sync-${run}@devhelp.test`));
  await db
    .delete(schema.contentRevisions)
    .where(eq(schema.contentRevisions.repo, repo));
});

const course = () =>
  db.query.courses.findFirst({ where: eq(schema.courses.slug, slug) });
const lessons = async () => {
  const c = await course();
  return db.query.lessons.findMany({
    where: eq(schema.lessons.courseId, c!.id),
    orderBy: (l, { asc }) => [asc(l.position)],
  });
};

describe("syncContent", () => {
  it("creates rows on first run and reports everything unchanged on the second", async () => {
    const first = await syncContent({ dir, sha: "a".repeat(40), repo });
    expect(first.courses.created).toBe(1);
    expect(first.lessons.created).toBe(2);
    expect(first.quizzes.created).toBe(1);
    expect(first.paths.created).toBe(1);

    const second = await syncContent({ dir, sha: "a".repeat(40), repo });
    expect(second.courses).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 1,
      archived: 0,
    });
    expect(second.lessons).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 2,
      archived: 0,
    });
    expect(second.quizzes).toMatchObject({ unchanged: 1 });
    expect(second.paths).toMatchObject({ unchanged: 1 });

    const rows = await lessons();
    expect(rows.map((l) => l.slug)).toEqual(["intro", "check"]);
    expect(rows[0]!.contentPath).toBe(`courses/${slug}/01-m1/01-intro.mdx`);
    const rev = await db.query.contentRevisions.findFirst({
      where: eq(schema.contentRevisions.id, rows[0]!.contentRevisionId!),
    });
    expect(rev?.commitSha).toBe("a".repeat(40));
  });

  it("leaves unchanged rows untouched on a new sha; the deployed commit is the latest revision row", async () => {
    const before = await lessons();
    await syncContent({ dir, sha: "b".repeat(40), repo });
    const after = await lessons();
    expect(after[0]!.updatedAt).toEqual(before[0]!.updatedAt);
    expect(after[0]!.contentRevisionId).toBe(before[0]!.contentRevisionId);
    const latest = await db.query.contentRevisions.findFirst({
      where: eq(schema.contentRevisions.repo, repo),
      orderBy: (r, { desc }) => [desc(r.publishedAt)],
    });
    expect(latest?.commitSha).toBe("b".repeat(40));
  });

  it("updates position and contentPath when a lesson file is renamed without content changes", async () => {
    const from = join(dir, "courses", slug, "01-m1", "01-intro.mdx");
    const to = join(dir, "courses", slug, "01-m1", "03-intro.mdx");
    cpSync(from, to);
    rmSync(from);
    const s = await syncContent({ dir, sha: "b1".repeat(20), repo });
    expect(s.lessons.updated).toBe(1);
    const rows = await lessons();
    const intro = rows.find((l) => l.slug === "intro")!;
    expect(intro.contentPath).toBe(`courses/${slug}/01-m1/03-intro.mdx`);
    expect(intro.position).toBe(1003);
    cpSync(to, from);
    rmSync(to);
    await syncContent({ dir, sha: "b2".repeat(20), repo });
  });

  it("refuses to sync an empty or missing content directory", async () => {
    const empty = mkdtempSync(join(tmpdir(), "devhelp-sync-empty-"));
    try {
      await expect(
        syncContent({ dir: empty, sha: "0".repeat(40), repo }),
      ).rejects.toThrow(/no courses|content has/);
      await expect(
        syncContent({ dir: join(empty, "missing"), sha: "0".repeat(40), repo }),
      ).rejects.toThrow();
      expect((await course())!.archivedAt).toBeNull();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("refuses cross-file errors such as a path pointing at an unknown course", async () => {
    const pathFile = join(dir, "paths", "p1.yaml");
    const original = readFileSync(pathFile, "utf8");
    writeFileSync(
      pathFile,
      original.replace(`courses: [${slug}]`, "courses: [nope]"),
    );
    try {
      await expect(
        syncContent({ dir, sha: "1".repeat(40), repo }),
      ).rejects.toThrow(/\[ref\]/);
    } finally {
      writeFileSync(pathFile, original);
    }
  });

  it("bumps the quiz version and replaces questions when the quiz changes", async () => {
    const rows = await lessons();
    const quizLesson = rows.find((l) => l.type === "quiz")!;
    const before = await db.query.quizzes.findFirst({
      where: eq(schema.quizzes.lessonId, quizLesson.id),
    });
    writeFileSync(
      quizFile(),
      readFileSync(quizFile(), "utf8").replace(
        "text: Right, correct: true",
        "text: Correct, correct: true",
      ),
    );
    const s = await syncContent({ dir, sha: "c".repeat(40), repo });
    expect(s.quizzes.updated).toBe(1);
    const after = await db.query.quizzes.findFirst({
      where: eq(schema.quizzes.lessonId, quizLesson.id),
    });
    expect(after!.version).toBe(before!.version + 1);
    const qs = await db.query.questions.findMany({
      where: eq(schema.questions.quizId, after!.id),
    });
    expect(qs).toHaveLength(1);
    expect(qs[0]!.options.find((o) => o.isCorrect)?.text).toBe("Correct");
    expect(qs[0]!.version).toBe(after!.version);
  });

  it("archives a removed lesson, keeps its progress rows, and excludes it from completion", async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: `sync-${run}@devhelp.test`, name: "Sync" })
      .returning();
    const rows = await lessons();
    const intro = rows.find((l) => l.slug === "intro")!;
    const check = rows.find((l) => l.slug === "check")!;
    await recordEvent({
      userId: user!.id,
      kind: "lesson_completed",
      lessonId: check.id,
      idempotencyKey: `lc:${user!.id}:${check.id}`,
    });

    rmSync(lessonFile());
    const s = await syncContent({ dir, sha: "d".repeat(40), repo });
    expect(s.lessons.archived).toBe(1);

    const archived = await db.query.lessons.findFirst({
      where: eq(schema.lessons.id, check.id),
    });
    expect(archived!.archivedAt).not.toBeNull();
    const progress = await db.query.lessonProgress.findMany({
      where: and(
        eq(schema.lessonProgress.userId, user!.id),
        eq(schema.lessonProgress.lessonId, check.id),
      ),
    });
    expect(progress).toHaveLength(1);
    const events = await db.query.progressEvents.findMany({
      where: inArray(schema.progressEvents.lessonId, [check.id]),
    });
    expect(events.length).toBeGreaterThan(0);

    // Only "intro" remains required, so completing it completes the course.
    const r = await recordEvent({
      userId: user!.id,
      kind: "lesson_completed",
      lessonId: intro.id,
      idempotencyKey: `lc:${user!.id}:${intro.id}`,
    });
    expect(r.courseCompleted).toBe(true);
  });

  it("never archives content that belongs to another repo", async () => {
    // A sync from an unrelated tree (like this test's) must leave the real content alone.
    const other = mkdtempSync(join(tmpdir(), "devhelp-sync-other-"));
    try {
      cpSync(
        join(import.meta.dirname, "../../content-schema/test/fixtures/valid"),
        other,
        { recursive: true },
      );
      const before = await db.query.courses.findMany({
        where: eq(schema.courses.slug, slug),
      });
      expect(before[0]!.archivedAt).toBeNull();
      await syncContent({
        dir: other,
        sha: "f".repeat(40),
        repo: `other/${run}`,
      });
      const after = await db.query.courses.findMany({
        where: eq(schema.courses.slug, slug),
      });
      expect(after[0]!.archivedAt).toBeNull();
    } finally {
      rmSync(other, { recursive: true, force: true });
      await db.delete(schema.courses).where(eq(schema.courses.slug, "c1"));
      await db.delete(schema.paths).where(eq(schema.paths.slug, "p1"));
      await db
        .delete(schema.contentRevisions)
        .where(eq(schema.contentRevisions.repo, `other/${run}`));
    }
  });

  it("refuses to sync content with schema errors", async () => {
    writeFileSync(
      join(dir, "courses", slug, "course.yaml"),
      "slug: not valid slug!\n",
    );
    await expect(
      syncContent({ dir, sha: "e".repeat(40), repo }),
    ).rejects.toThrow(/\[schema\]/);
  });
});
