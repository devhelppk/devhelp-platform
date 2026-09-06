import { z } from "zod";
import { slug } from "./common.ts";

export const exerciseRunner = z.enum(["sandpack", "pyodide"]);

/** `exercises/<id>/exercise.yaml`; `starter/` and `tests/` are read from disk. */
export const exerciseMeta = z
  .object({
    id: slug,
    runner: exerciseRunner,
    language: z.enum(["javascript", "typescript", "react", "html", "python"]),
    /** Entry file shown first in the editor. */
    entry: z.string().min(1),
  })
  .strict();
export type ExerciseMeta = z.infer<typeof exerciseMeta>;
