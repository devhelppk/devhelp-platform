import type { ContentTree, Diagnostic, LoadedExercise } from "./load.ts";
import { runJsInNode } from "@repo/exercise-runner/node";

export type ExerciseRunner = (
  ex: LoadedExercise,
  files: Record<string, string>,
) => { passed: boolean; output: string };

export type CheckOptions = {
  /**
   * Also run JS/TS exercises through the browser harness (the exact code the
   * LMS ships) so any test feature outside its vitest subset fails here.
   * Default true; async, so use `checkContentAsync`.
   */
  parity?: boolean;
  /**
   * Runs exercise tests (solution must pass, starter should fail). Pass
   * `runExerciseTests` from `./exercise-runner` (a child process; keep it out of
   * app bundles). Omit to skip exercise execution.
   */
  runExercises?: ExerciseRunner;
};

/**
 * Semantic checks on a loaded tree. Schema/parse problems are already in
 * `tree.diagnostics`; this adds cross-file rules. Pure: no I/O.
 */
export function checkContent(
  tree: ContentTree,
  options: CheckOptions = {},
): Diagnostic[] {
  const out: Diagnostic[] = [...tree.diagnostics];
  const err = (file: string, rule: string, message: string) =>
    out.push({ level: "error", file, rule, message });
  const warn = (file: string, rule: string, message: string) =>
    out.push({ level: "warning", file, rule, message });

  const courseSlugs = new Map<string, string>();
  for (const course of tree.courses) {
    if (courseSlugs.has(course.meta.slug)) {
      err(
        course.file,
        "unique-slug",
        `course slug "${course.meta.slug}" also used in ${courseSlugs.get(course.meta.slug)}`,
      );
    }
    courseSlugs.set(course.meta.slug, course.file);
  }

  for (const course of tree.courses) {
    const { meta } = course;
    for (const p of meta.prerequisites) {
      if (!courseSlugs.has(p))
        err(course.file, "ref", `prerequisite "${p}" is not a course`);
      if (p === meta.slug)
        err(course.file, "ref", "a course cannot be its own prerequisite");
    }
    if (/lorem ipsum/i.test(meta.summary))
      warn(course.file, "style", "placeholder text in summary");

    const quizIds = new Map(course.quizzes.map((q) => [q.data.id, q]));
    const exerciseIds = new Map(course.exercises.map((e) => [e.meta.id, e]));
    const moduleSlugs = new Set<string>();
    const lessonSlugs = new Set<string>();
    let requiredCount = 0;

    for (const mod of course.modules) {
      if (moduleSlugs.has(mod.meta.slug))
        err(mod.file, "unique-slug", `module slug "${mod.meta.slug}" repeated`);
      moduleSlugs.add(mod.meta.slug);
      if (mod.lessons.length === 0)
        warn(mod.file, "structure", "module has no lessons");

      for (const lesson of mod.lessons) {
        const m = lesson.meta;
        if (lessonSlugs.has(m.slug))
          err(
            lesson.file,
            "unique-slug",
            `lesson slug "${m.slug}" repeated in course`,
          );
        lessonSlugs.add(m.slug);
        if (m.isRequired) requiredCount++;

        const expectedRule: Record<string, string> = {
          article: "view",
          link: "view",
          video: "view",
          quiz: "quiz_pass",
          exercise: "exercise_pass",
          project: "submit",
        };
        if (m.completionRule !== expectedRule[m.type]) {
          err(
            lesson.file,
            "completion-rule",
            `type "${m.type}" must use completionRule "${expectedRule[m.type]}"`,
          );
        }
        if (m.type === "quiz" && !quizIds.has(m.quiz))
          err(
            lesson.file,
            "ref",
            `quiz "${m.quiz}" not found in ${course.dir}/quizzes`,
          );
        if (m.type === "exercise" && !exerciseIds.has(m.exercise)) {
          err(
            lesson.file,
            "ref",
            `exercise "${m.exercise}" not found in ${course.dir}/exercises`,
          );
        }
        if (m.type !== "quiz" && m.type !== "link" && lesson.body.length < 40) {
          warn(lesson.file, "body", "lesson body is very short");
        }
        if (/lorem ipsum/i.test(lesson.body))
          warn(lesson.file, "style", "placeholder text in body");
        if (!m.durationMinutes)
          warn(lesson.file, "meta", "durationMinutes missing");

        // Internal links: /courses/<course>/<lesson> must resolve inside this content tree.
        for (const match of lesson.body.matchAll(
          /\]\(\/courses\/([a-z0-9-]+)\/([a-z0-9-]+)\)/g,
        )) {
          const [, c, l] = match;
          const target = tree.courses.find((x) => x.meta.slug === c);
          const ok = target?.modules.some((mm) =>
            mm.lessons.some((ll) => ll.meta.slug === l),
          );
          if (!ok)
            err(lesson.file, "link", `broken internal link /courses/${c}/${l}`);
        }
        // Images must exist under the course's assets directory.
        for (const match of lesson.body.matchAll(
          /!\[[^\]]*\]\((?!https?:)([^)]+)\)/g,
        )) {
          const target = match[1]!;
          if (
            !tree.assets.has(`${course.dir}/${target.replace(/^\.\//, "")}`)
          ) {
            err(lesson.file, "image", `image not found: ${target}`);
          }
        }
      }
    }
    if (requiredCount === 0)
      err(
        course.file,
        "structure",
        "course has no required lessons; it could never be completed",
      );

    for (const quiz of course.quizzes) {
      const ids = new Set<string>();
      for (const q of quiz.data.questions) {
        if (ids.has(q.id))
          err(quiz.file, "unique-id", `question id "${q.id}" repeated`);
        ids.add(q.id);
        if (q.type === "single" || q.type === "multi") {
          const correct = q.options.filter((o) => o.correct).length;
          const optIds = new Set(q.options.map((o) => o.id));
          if (optIds.size !== q.options.length)
            err(
              quiz.file,
              "unique-id",
              `question "${q.id}" has duplicate option ids`,
            );
          if (q.type === "single" && correct !== 1)
            err(
              quiz.file,
              "answer",
              `question "${q.id}" must have exactly one correct option (has ${correct})`,
            );
          if (q.type === "multi" && correct < 1)
            err(
              quiz.file,
              "answer",
              `question "${q.id}" needs at least one correct option`,
            );
        }
      }
      const used = course.modules.some((m) =>
        m.lessons.some(
          (l) => l.meta.type === "quiz" && l.meta.quiz === quiz.data.id,
        ),
      );
      if (!used)
        warn(
          quiz.file,
          "unused",
          `quiz "${quiz.data.id}" is not referenced by any lesson`,
        );
    }

    for (const ex of course.exercises) {
      if (!(ex.meta.entry in ex.starterFiles))
        err(ex.file, "ref", `entry "${ex.meta.entry}" not found in starter/`);
      if (Object.keys(ex.testFiles).length === 0)
        err(ex.file, "structure", "exercise has no tests/");
      if (!ex.instructions)
        warn(ex.file, "structure", "exercise has no README.mdx");
      if (Object.keys(ex.solutionFiles).length === 0)
        err(ex.file, "structure", "exercise has no solution/");
      if (
        options.runExercises &&
        Object.keys(ex.testFiles).length > 0 &&
        Object.keys(ex.solutionFiles).length > 0
      ) {
        const solution = options.runExercises(ex, ex.solutionFiles);
        if (!solution.passed)
          err(
            ex.file,
            "tests",
            `solution does not pass its tests:\n${solution.output.trim().slice(-800)}`,
          );
        // Python is only syntax-checked here (tests run in the browser), so "passes" means nothing for it.

        if (ex.meta.runner !== "pyodide") {
          const starter = options.runExercises(ex, ex.starterFiles);

          if (starter.passed)
            warn(
              ex.file,
              "tests",
              "starter already passes every test; the exercise has nothing to fix",
            );
        }
      }
      const used = course.modules.some((m) =>
        m.lessons.some(
          (l) => l.meta.type === "exercise" && l.meta.exercise === ex.meta.id,
        ),
      );
      if (!used)
        warn(
          ex.file,
          "unused",
          `exercise "${ex.meta.id}" is not referenced by any lesson`,
        );
    }
  }

  for (const path of tree.paths) {
    for (const c of path.data.courses) {
      if (!courseSlugs.has(c))
        err(path.file, "ref", `path references unknown course "${c}"`);
    }
    if (new Set(path.data.courses).size !== path.data.courses.length)
      err(path.file, "unique-slug", "path lists a course twice");
  }
  for (const badge of tree.badges) {
    const r = badge.data.rule;
    if (r.kind === "course_completed" && !courseSlugs.has(r.course))
      err(badge.file, "ref", `badge references unknown course "${r.course}"`);
    if (
      r.kind === "path_completed" &&
      !tree.paths.some((p) => p.data.slug === r.path)
    )
      err(badge.file, "ref", `badge references unknown path "${r.path}"`);
  }

  return out;
}

export type { Diagnostic } from "./load.ts";

/**
 * `checkContent` plus the browser-harness parity run for sandpack (JS/TS)
 * exercises: solution must pass, starter must not fully pass.
 */
export async function checkContentAsync(
  tree: ContentTree,
  options: CheckOptions = {},
): Promise<Diagnostic[]> {
  const out = checkContent(tree, options);
  if (options.parity === false) return out;
  for (const course of tree.courses) {
    for (const ex of course.exercises) {
      if (
        ex.meta.runner !== "sandpack" ||
        Object.keys(ex.testFiles).length === 0
      )
        continue;
      if (Object.keys(ex.solutionFiles).length) {
        const sol = await runJsInNode({
          files: ex.solutionFiles,
          testFiles: ex.testFiles,
        });
        if (!sol.passed) {
          const why =
            sol.fatal ??
            sol.results
              .filter((r) => !r.passed)
              .map((r) => `${r.name}: ${r.error}`)
              .join("; ");
          out.push({
            level: "error",
            file: ex.file,
            rule: "parity",
            message: `solution fails in the browser harness (only the vitest subset is supported): ${why}`,
          });
        }
      }
      const starter = await runJsInNode({
        files: ex.starterFiles,
        testFiles: ex.testFiles,
      });
      if (starter.passed)
        out.push({
          level: "warning",
          file: ex.file,
          rule: "parity",
          message:
            "starter already passes in the browser harness; nothing to fix",
        });
      if (starter.fatal && !/expected|AssertionError/.test(starter.fatal)) {
        out.push({
          level: "error",
          file: ex.file,
          rule: "parity",
          message: `starter does not load in the browser harness: ${starter.fatal}`,
        });
      }
    }
  }
  return out;
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.level === "error");
}
