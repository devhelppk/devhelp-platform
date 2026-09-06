import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import { lessonFrontmatter } from "@repo/content-schema/schemas";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { resolve } from "node:path";
import { z } from "zod";

/* global process */

/**
 * Lesson bodies are compiled at build time from the pinned content checkout
 * (`pnpm content:pull` → `.content/`, or CONTENT_DIR while authoring).
 * Metadata lives in Postgres (pnpm content:sync); this only carries the body.
 */
// Same rule as @repo/content: CONTENT_DIR resolves from the repo root, empty means unset.
const repoRoot = resolve(import.meta.dirname, "../..");
const contentDir = resolve(
  repoRoot,
  process.env.CONTENT_DIR?.trim() || ".content",
);

const lessons = defineCollection({
  name: "lessons",
  directory: `${contentDir}/courses`,
  // <course>/<module>/<lesson>.mdx only; exercise READMEs live two levels deeper.
  include: "*/*/*.mdx",
  // Loose here; the strict discriminated union runs in `transform` (extra keys are the point).
  schema: z
    .object({ slug: z.string(), title: z.string(), type: z.string() })
    .loose(),
  transform: async (doc, ctx) => {
    // Strict validation against the shared schema so a bad lesson fails the build (X10).
    const { content, _meta, ...frontmatter } = doc;
    void content; // compiled below; excluded from the frontmatter validation
    const meta = lessonFrontmatter.parse(frontmatter);
    const body = await compileMDX(ctx, doc, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    });
    const [courseDir = "", moduleDir = ""] = _meta.directory.split("/");
    return {
      ...meta,
      contentPath: `courses/${_meta.filePath}`,
      courseDir,
      moduleDir,
      body,
    };
  },
});

export default defineConfig({ content: [lessons] });
