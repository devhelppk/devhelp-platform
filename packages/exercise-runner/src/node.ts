import { runJs } from "./js-runner.ts";
import type { FileMap, RunOutcome } from "./types.ts";

/** Node entry for content:check parity: same harness, same transpile, no Worker. */
export function runJsInNode(input: {
  files: FileMap;
  testFiles: FileMap;
  timeoutMs?: number;
}): Promise<RunOutcome> {
  return runJs(input);
}
