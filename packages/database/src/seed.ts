import { db, schema } from "./index";

async function main() {
  const [author] = await db
    .insert(schema.users)
    .values({
      email: "team@devhelp.pk",
      name: "devhelp team",
      role: "admin",
      city: "Karachi",
    })
    .onConflictDoNothing()
    .returning();

  const [course] = await db
    .insert(schema.courses)
    .values({
      slug: "ai-engineering-foundations",
      title: "AI Engineering Foundations",
      summary:
        "How software engineering actually works in 2026: coding with agents, evals, and shipping reliably.",
      track: "technical",
      level: "beginner",
      isPublished: true,
      authorId: author?.id,
    })
    .onConflictDoNothing()
    .returning();

  if (!course) {
    console.log("Seed data already present, nothing to do.");
    return;
  }

  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId: course.id, title: "Getting started", position: 0 })
    .returning();

  await db.insert(schema.lessons).values([
    {
      moduleId: mod!.id,
      slug: "welcome",
      title: "Welcome to devhelp",
      type: "article",
      content: "# Welcome\n\nThis is your first lesson.",
      durationMinutes: 5,
      position: 0,
    },
    {
      moduleId: mod!.id,
      slug: "your-first-agentic-workflow",
      title: "Your first agentic workflow",
      type: "exercise",
      durationMinutes: 30,
      position: 1,
    },
  ]);

  console.log(`Seeded course "${course.title}" with 2 lessons.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
