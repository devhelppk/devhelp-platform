import type { FileMap, RunOutcome } from "./types.ts";

/** Pinned CDN build; bump deliberately and re-run the browser loop. */
export const PYODIDE_VERSION = "0.29.4";
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type Pyodide = {
  FS: {
    mkdirTree(p: string): void;
    writeFile(p: string, data: string): void;
    analyzePath(p: string): { exists: boolean };
  };
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(o: { batched: (s: string) => void }): void;
  setStderr(o: { batched: (s: string) => void }): void;
  globals: { get(name: string): unknown };
};

let instance: Promise<Pyodide> | null = null;

/** Load Pyodide once per Worker; the browser caches the ~10 MB runtime. */
export async function getPyodide(
  loadPyodide: (opts: { indexURL: string }) => Promise<Pyodide>,
): Promise<Pyodide> {
  instance ??= loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  return instance;
}

/**
 * Test protocol for Python exercises: every `tests/test_*.py` is imported,
 * each top-level `test_*` function runs, `assert` failures are reported.
 */
const COLLECTOR = `
import importlib, inspect, json, sys, traceback, glob, os
sys.path.insert(0, "/exercise/starter")
sys.path.insert(0, "/exercise/tests")
results = []
for path in sorted(glob.glob("/exercise/tests/test_*.py")):
    name = os.path.splitext(os.path.basename(path))[0]
    try:
        mod = importlib.import_module(name)
    except Exception as e:
        results.append({"name": name, "passed": False, "error": f"{type(e).__name__}: {e}"})
        continue
    for fname, fn in inspect.getmembers(mod, inspect.isfunction):
        if not fname.startswith("test_") or fn.__module__ != mod.__name__:
            continue
        try:
            fn()
            results.append({"name": f"{name} › {fname}", "passed": True})
        except AssertionError as e:
            # A bare assert carries no message; show the failing line so the learner knows what was checked.
            frame = traceback.extract_tb(e.__traceback__)[-1]
            where = f"line {frame.lineno}: {frame.line.strip()}" if frame.line else f"line {frame.lineno}"
            results.append({"name": f"{name} › {fname}", "passed": False, "error": f"AssertionError: {e}" if str(e) else f"AssertionError at {where}"})
        except Exception as e:
            results.append({"name": f"{name} › {fname}", "passed": False, "error": f"{type(e).__name__}: {e}"})
json.dumps(results)
`;

export async function runPy(
  py: Pyodide,
  input: { files: FileMap; testFiles: FileMap },
): Promise<RunOutcome> {
  const started = Date.now();
  const logs: string[] = [];
  py.setStdout({ batched: (s) => logs.push(`[log] ${s}`) });
  py.setStderr({ batched: (s) => logs.push(`[error] ${s}`) });
  try {
    // Start from an empty tree so a file deleted or renamed since the last run
    // cannot leak into this one.
    if (py.FS.analyzePath("/exercise").exists)
      await py.runPythonAsync('import shutil\nshutil.rmtree("/exercise")');
    py.FS.mkdirTree("/exercise/starter");
    py.FS.mkdirTree("/exercise/tests");
    for (const [name, code] of Object.entries(input.files))
      py.FS.writeFile(`/exercise/starter/${name}`, code);
    for (const [name, code] of Object.entries(input.testFiles))
      py.FS.writeFile(`/exercise/tests/${name}`, code);
    // Drop cached modules from a previous run so edits take effect.
    await py.runPythonAsync(
      `import sys\nfor m in [m for m in sys.modules if m.startswith("test_") or m in ${JSON.stringify(Object.keys(input.files).map((f) => f.replace(/\.py$/, "")))}]:\n    del sys.modules[m]`,
    );
    const raw = (await py.runPythonAsync(COLLECTOR)) as string;
    const results = JSON.parse(raw) as RunOutcome["results"];
    if (results.length === 0)
      return {
        results,
        passed: false,
        logs,
        durationMs: Date.now() - started,
        fatal: "No tests were found (tests/test_*.py with test_* functions).",
      };
    return {
      results,
      passed: results.every((r) => r.passed),
      logs,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      results: [],
      passed: false,
      logs,
      durationMs: Date.now() - started,
      fatal: e instanceof Error ? e.message : String(e),
    };
  }
}
