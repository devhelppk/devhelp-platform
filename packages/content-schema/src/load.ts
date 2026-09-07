import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import type { ZodType } from "zod";
import { stableHash } from "./hash.ts";
import {
  badgeFile,
  courseMeta,
  exerciseMeta,
  lessonFrontmatter,
  moduleMeta,
  movedFieldMessage,
  pathFile,
  quizFile,
  type BadgeFile,
  type CourseMeta,
  type ExerciseMeta,
  type LessonFrontmatter,
  type ModuleMeta,
  type PathFile,
  type QuizFile,
} from "./schemas/index.ts";

export type Diagnostic = {
  level: "error" | "warning";
  file: string;
  rule: string;
  message: string;
  line?: number;
};

export type LoadedLesson = {
  file: string;
  meta: LessonFrontmatter;
  body: string;
  hash: string;
  order: number;
};
export type LoadedModule = {
  file: string;
  meta: ModuleMeta;
  lessons: LoadedLesson[];
  order: number;
};
export type LoadedExercise = {
  file: string;
  dir: string;
  meta: ExerciseMeta;
  instructions: string;
  starterFiles: Record<string, string>;
  solutionFiles: Record<string, string>;
  testFiles: Record<string, string>;
  hash: string;
};
export type LoadedQuiz = { file: string; data: QuizFile; hash: string };
export type LoadedCourse = {
  dir: string;
  file: string;
  meta: CourseMeta;
  modules: LoadedModule[];
  quizzes: LoadedQuiz[];
  exercises: LoadedExercise[];
  hash: string;
};
export type ContentTree = {
  root: string;
  courses: LoadedCourse[];
  paths: { file: string; data: PathFile }[];
  badges: { file: string; data: BadgeFile }[];
  /** Every non-content file (images etc.) as a root-relative path, for link/image checks. */
  assets: Set<string>;
  diagnostics: Diagnostic[];
};

/**
 * Read a content directory into a typed tree. Parse and schema errors become
 * diagnostics (the tree is still returned so `check` can report everything at once).
 */
export function loadContentTree(root: string): ContentTree {
  const diagnostics: Diagnostic[] = [];
  const rel = (p: string) => relative(root, p).split("\\").join("/");

  function parseFile<T>(
    file: string,
    schema: ZodType<T>,
    raw: unknown,
  ): T | null {
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      // A field that moved to the studio (S11) fails as "unrecognized key",
      // which tells a contributor nothing. Say where it went instead.
      const moved =
        issue.code === "unrecognized_keys"
          ? issue.keys.map(movedFieldMessage).filter(Boolean)
          : [];
      for (const message of moved)
        diagnostics.push({
          level: "error",
          file: rel(file),
          rule: "moved-field",
          message: message!,
        });
      // Only the moved keys are explained away; anything else in the same
      // issue is still reported, or a genuine typo alongside a moved field
      // would go unmentioned until the next run.
      const remaining =
        issue.code === "unrecognized_keys"
          ? issue.keys.filter((k) => !movedFieldMessage(k))
          : null;
      if (remaining && !remaining.length) continue;
      if (remaining) {
        diagnostics.push({
          level: "error",
          file: rel(file),
          rule: "schema",
          message: `unrecognized keys: ${remaining.map((k) => `"${k}"`).join(", ")}`,
        });
        continue;
      }
      diagnostics.push({
        level: "error",
        file: rel(file),
        rule: "schema",
        message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      });
    }
    return null;
  }
  function readYaml<T>(file: string, schema: ZodType<T>): T | null {
    try {
      return parseFile(file, schema, parseYaml(readFileSync(file, "utf8")));
    } catch (err) {
      diagnostics.push({
        level: "error",
        file: rel(file),
        rule: "yaml",
        message: String(err),
      });
      return null;
    }
  }
  const listDirs = (dir: string) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter(
            (n) => !n.startsWith(".") && statSync(join(dir, n)).isDirectory(),
          )
          .sort()
      : [];
  const listFiles = (dir: string, ext: string) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((n) => n.endsWith(ext) && !n.startsWith("."))
          .sort()
      : [];
  /** `NN-` prefix is mandatory for modules and lessons; missing prefixes are reported, never guessed. */
  const orderOf = (name: string, file: string) => {
    const m = /^(\d+)-/.exec(name);
    if (!m) {
      diagnostics.push({
        level: "error",
        file,
        rule: "order-prefix",
        message: `"${name}" must start with a numeric order prefix like 01-`,
      });
      return 0;
    }
    return Number(m[1]);
  };
  const readDirFiles = (dir: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const walk = (d: string, prefix: string) => {
      for (const name of existsSync(d) ? readdirSync(d).sort() : []) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p, `${prefix}${name}/`);
        else out[`${prefix}${name}`] = readFileSync(p, "utf8");
      }
    };
    walk(dir, "");
    return out;
  };

  const courses: LoadedCourse[] = [];
  if (!existsSync(join(root, "courses"))) {
    diagnostics.push({
      level: "error",
      file: rel(root) || ".",
      rule: "structure",
      message: `no courses/ directory in ${root}; wrong CONTENT_DIR or content not pulled?`,
    });
  }
  for (const courseDirName of listDirs(join(root, "courses"))) {
    const dir = join(root, "courses", courseDirName);
    const courseFile = join(dir, "course.yaml");
    if (!existsSync(courseFile)) {
      diagnostics.push({
        level: "error",
        file: rel(dir),
        rule: "structure",
        message: "missing course.yaml",
      });
      continue;
    }
    const meta = readYaml(courseFile, courseMeta);
    if (!meta) continue;

    const modules: LoadedModule[] = [];
    for (const modName of listDirs(dir)) {
      if (
        modName === "quizzes" ||
        modName === "exercises" ||
        modName === "assets"
      )
        continue;
      const modDir = join(dir, modName);
      const modFile = join(modDir, "module.yaml");
      if (!existsSync(modFile)) {
        diagnostics.push({
          level: "error",
          file: rel(modDir),
          rule: "structure",
          message: "missing module.yaml",
        });
        continue;
      }
      const modMeta = readYaml(modFile, moduleMeta);
      if (!modMeta) continue;
      const lessons: LoadedLesson[] = [];
      for (const lessonName of listFiles(modDir, ".mdx")) {
        const file = join(modDir, lessonName);
        let parsed: matter.GrayMatterFile<string>;
        try {
          // Same YAML engine as Content Collections, so `updated: 2026-09-01` stays a string here too.
          parsed = matter(readFileSync(file, "utf8"), {
            engines: { yaml: (src) => parseYaml(src) as object },
          });
        } catch (err) {
          diagnostics.push({
            level: "error",
            file: rel(file),
            rule: "frontmatter",
            message: String(err),
          });
          continue;
        }
        const fm = parseFile(file, lessonFrontmatter, parsed.data);
        if (!fm) continue;
        const body = parsed.content.trim();
        lessons.push({
          file: rel(file),
          meta: fm,
          body,
          hash: stableHash(fm, body),
          order: orderOf(lessonName, rel(file)),
        });
      }
      modules.push({
        file: rel(modFile),
        meta: modMeta,
        lessons,
        order: orderOf(modName, rel(modDir)),
      });
    }

    const quizzes: LoadedQuiz[] = [];
    for (const name of listFiles(join(dir, "quizzes"), ".yaml")) {
      const file = join(dir, "quizzes", name);
      const data = readYaml(file, quizFile);
      if (data) quizzes.push({ file: rel(file), data, hash: stableHash(data) });
    }

    const exercises: LoadedExercise[] = [];
    for (const name of listDirs(join(dir, "exercises"))) {
      const exDir = join(dir, "exercises", name);
      const metaFile = join(exDir, "exercise.yaml");
      if (!existsSync(metaFile)) {
        diagnostics.push({
          level: "error",
          file: rel(exDir),
          rule: "structure",
          message: "missing exercise.yaml",
        });
        continue;
      }
      const exMeta = readYaml(metaFile, exerciseMeta);
      if (!exMeta) continue;
      const readme = join(exDir, "README.mdx");
      const instructions = existsSync(readme)
        ? matter(readFileSync(readme, "utf8")).content.trim()
        : "";
      const starterFiles = readDirFiles(join(exDir, "starter"));
      const solutionFiles = readDirFiles(join(exDir, "solution"));
      const testFiles = readDirFiles(join(exDir, "tests"));
      exercises.push({
        file: rel(metaFile),
        dir: rel(exDir),
        meta: exMeta,
        instructions,
        starterFiles,
        solutionFiles,
        testFiles,
        hash: stableHash({
          exMeta,
          instructions,
          starterFiles,
          solutionFiles,
          testFiles,
        }),
      });
    }

    courses.push({
      dir: rel(dir),
      file: rel(courseFile),
      meta,
      modules,
      quizzes,
      exercises,
      hash: stableHash({
        meta,
        modules: modules.map((m) => [m.meta, m.lessons.map((l) => l.hash)]),
      }),
    });
  }

  function readCollection<T>(
    sub: string,
    schema: ZodType<T>,
  ): { file: string; data: T }[] {
    const out: { file: string; data: T }[] = [];
    for (const name of listFiles(join(root, sub), ".yaml")) {
      const file = join(root, sub, name);
      const data = readYaml(file, schema);
      if (data) out.push({ file: rel(file), data });
    }
    return out;
  }

  const assets = new Set<string>();
  const walkAssets = (d: string) => {
    for (const name of existsSync(d) ? readdirSync(d) : []) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walkAssets(p);
      else if (!/\.(mdx|yaml|yml|md)$/.test(name)) assets.add(rel(p));
    }
  };
  walkAssets(join(root, "courses"));

  return {
    root,
    courses,
    assets,
    paths: readCollection("paths", pathFile),
    badges: readCollection("badges", badgeFile),
    diagnostics,
  };
}

export { basename };
