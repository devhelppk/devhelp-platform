import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import { lessonFrontmatter } from "@repo/content-schema/schemas";
import rehypeShiki from "@shikijs/rehype";
import type { ShikiTransformer } from "shiki";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { z } from "zod";

/* global process */

/**
 * Lesson bodies are compiled at build time from the pinned content checkout
 * (`pnpm content:pull` → `.content/`, or CONTENT_DIR while authoring).
 * Metadata lives in Postgres (pnpm content:sync); this only carries the body.
 */
// Same rule as @repo/content: CONTENT_DIR resolves from the repo root, empty means unset.
// Walk up from cwd (apps/lms in dev and build): import.meta is not reliable in a bundled config,
// and Content Collections joins `directory` onto the config's directory, so it must be relative.
function findRepoRoot(from: string): string {
  let d = from;
  while (!existsSync(join(d, "pnpm-workspace.yaml")) && dirname(d) !== d)
    d = dirname(d);
  return d;
}
const repoRoot = findRepoRoot(process.cwd());
const contentDir = relative(
  process.cwd(),
  resolve(repoRoot, process.env.CONTENT_DIR?.trim() || ".content"),
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
      rehypePlugins: [
        rehypeSlug,
        // Highlight at build time; both themes are emitted as CSS variables so no highlighter JS ships.
        [
          rehypeShiki,
          {
            themes: { light: "github-light", dark: "github-dark" },
            defaultColor: false,
            // Expose the fence language so the code block can label it.
            transformers: [
              {
                name: "devhelp:data-language",
                pre(node) {
                  node.properties["data-language"] = this.options.lang ?? "";
                },
              } satisfies ShikiTransformer,
            ],
          },
        ],
      ],
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
