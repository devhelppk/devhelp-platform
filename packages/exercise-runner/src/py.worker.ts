/// <reference lib="webworker" />
import { getPyodide, PYODIDE_INDEX_URL, runPy } from "./py-runner.ts";
import type { RunRequest } from "./types.ts";

type Py = Parameters<typeof runPy>[0];
type LoadPyodide = (opts: { indexURL: string }) => Promise<Py>;

// Module worker (Turbopack only bundles `type: "module"` workers). Pyodide's
// ESM build is imported at runtime from the pinned CDN URL; the `Function`
// indirection keeps the bundler from trying to resolve it at build time.
const importUrl = new Function("u", "return import(u)") as (
  u: string,
) => Promise<{ loadPyodide: LoadPyodide }>;

let loaded: Promise<Py> | null = null;
function load() {
  loaded ??= importUrl(`${PYODIDE_INDEX_URL}pyodide.mjs`)
    .then((m) => getPyodide(m.loadPyodide))
    .catch((e: unknown) => {
      loaded = null; // let the next run retry a failed download
      throw e;
    });
  return loaded;
}

self.onmessage = async (
  e: MessageEvent<{ id: number; request: RunRequest | { warmup: true } }>,
) => {
  const { id, request } = e.data;
  try {
    if ("warmup" in request) {
      await load();
      self.postMessage({ id, ready: true });
      return;
    }
    const py = await load();
    const outcome = await runPy(py, {
      files: request.files,
      testFiles: request.testFiles,
    });
    self.postMessage({ id, outcome });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
