// Runtime-safe surface (no child processes): schemas, loader, hashing.
// The checker (which shells out to vitest) lives at `@repo/content-schema/check`.
export * from "./schemas/index.ts";
export { loadContentTree } from "./load.ts";
export type {
  ContentTree,
  Diagnostic,
  LoadedCourse,
  LoadedExercise,
  LoadedLesson,
  LoadedModule,
  LoadedQuiz,
} from "./load.ts";
export { stableHash } from "./hash.ts";
