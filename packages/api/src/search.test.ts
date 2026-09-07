import { db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
const token = `zylophonics${run.replace(/[^a-z]/g, "") || "x"}`;
const ids: string[] = [];
let orgId: string;

const as = () =>
  createCaller({ db, headers: new Headers(), session: null } as Context);

beforeAll(async () => {
  // A published course whose title carries the token, and a lesson under it.
  const [published] = await db
    .insert(schema.courses)
    .values({
      slug: `search-pub-${run}`,
      title: `${token} for engineers`,
      summary: "A course that exists only so search has something to find.",
      description: "Mentions widgets and pipelines in the body text.",
      isPublished: true,
    })
    .returning();
  ids.push(published!.id);
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId: published!.id, slug: "m1", title: "M1", position: 1 })
    .returning();
  await db.insert(schema.lessons).values({
    courseId: published!.id,
    moduleId: mod!.id,
    slug: "l1",
    title: `Introducing ${token}`,
    position: 1,
  });
  // An unpublished course, and an archived lesson in the published one.
  const [draft] = await db
    .insert(schema.courses)
    .values({
      slug: `search-draft-${run}`,
      title: `${token} in secret`,
      summary: "A course nobody has published, which must never be found.",
      isPublished: false,
    })
    .returning();
  ids.push(draft!.id);
  await db.insert(schema.lessons).values({
    courseId: published!.id,
    moduleId: mod!.id,
    slug: "gone",
    title: `Archived ${token}`,
    position: 2,
    archivedAt: new Date(),
  });
  // A published company whose name carries the token.
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `${token} Systems`,
      slug: `search-co-${run}`,
      kind: "company",
      createdAt: new Date(),
    })
    .returning();
  orgId = org!.id;
  await db
    .insert(schema.companyProfiles)
    .values({ organizationId: orgId, status: "published" });
  // And a pending one, which is not public.
  const [pending] = await db
    .insert(schema.organizations)
    .values({
      name: `${token} Hidden`,
      slug: `search-hidden-${run}`,
      kind: "company",
      createdAt: new Date(),
    })
    .returning();
  await db
    .insert(schema.companyProfiles)
    .values({ organizationId: pending!.id, status: "pending" });
  ids.push(pending!.id);
});

afterAll(async () => {
  await db.delete(schema.courses).where(eq(schema.courses.id, ids[0]!));
  await db.delete(schema.courses).where(eq(schema.courses.id, ids[1]!));
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, orgId));
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, ids[2]!));
});

describe("search", () => {
  it("finds a course, a lesson, and a company for one query", async () => {
    const r = await as().search.query({ q: token });
    expect(r.courses.map((c) => c.slug)).toContain(`search-pub-${run}`);
    expect(r.lessons.map((l) => l.slug)).toContain("l1");
    expect(r.companies.map((c) => c.slug)).toContain(`search-co-${run}`);
  });

  it("never returns anything unpublished or archived", async () => {
    const r = await as().search.query({ q: token });
    expect(r.courses.map((c) => c.slug)).not.toContain(`search-draft-${run}`);
    expect(r.lessons.map((l) => l.slug)).not.toContain("gone");
    expect(r.companies.map((c) => c.slug)).not.toContain(
      `search-hidden-${run}`,
    );
  });

  it("ranks a title match above a body-only match", async () => {
    const [other] = await db
      .insert(schema.courses)
      .values({
        slug: `search-body-${run}`,
        title: "Something else entirely",
        summary: `A summary that merely mentions ${token} in passing.`,
        isPublished: true,
      })
      .returning();
    const r = await as().search.query({ q: token });
    const slugs = r.courses.map((c) => c.slug);
    expect(slugs.indexOf(`search-pub-${run}`)).toBeLessThan(
      slugs.indexOf(`search-body-${run}`),
    );
    await db.delete(schema.courses).where(eq(schema.courses.id, other!.id));
  });

  it("returns nothing rather than erroring for a query that matches nothing", async () => {
    const r = await as().search.query({ q: "qwertyuiopasdfgh" });
    expect(r.total).toBe(0);
    expect(r.courses).toEqual([]);
  });

  it("survives punctuation a person might actually type", async () => {
    // `websearch_to_tsquery` handles these; `plainto_` or raw `to_tsquery`
    // would throw on some of them.
    for (const q of [`"${token}"`, `${token} or widgets`, `${token} -nothing`])
      await expect(as().search.query({ q })).resolves.toBeDefined();
  });
});
