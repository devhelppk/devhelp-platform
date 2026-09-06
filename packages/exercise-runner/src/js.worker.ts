/// <reference lib="webworker" />
import { runJs } from "./js-runner.ts";
import type { RunRequest } from "./types.ts";

self.onmessage = async (
  e: MessageEvent<{ id: number; request: RunRequest }>,
) => {
  const { id, request } = e.data;
  try {
    const outcome = await runJs({
      files: request.files,
      testFiles: request.testFiles,
      timeoutMs: request.timeoutMs,
    });
    self.postMessage({ id, outcome });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
