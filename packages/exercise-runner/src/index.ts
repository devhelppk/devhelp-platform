import type { RunOutcome, RunRequest } from "./types.ts";

export type { FileMap, RunOutcome, RunRequest, TestResult } from "./types.ts";

export type Runner = {
  run(request: Omit<RunRequest, "runner">): Promise<RunOutcome>;
  terminate(): void;
};

/**
 * Browser runner backed by a dedicated module Worker per exercise mount
 * (Turbopack bundles module workers into chunks; a classic worker's file is
 * emitted as a raw asset). A run that exceeds `timeoutMs` (infinite loop)
 * kills the Worker and reports a fatal result; the next run spins up a fresh
 * one. JavaScript and TypeScript only (founder decision, end of S4).
 */
export function createRunner(opts: { timeoutMs?: number } = {}): Runner {
  let worker: Worker | null = null;
  let seq = 0;
  const timeoutMs = opts.timeoutMs ?? 8_000;

  const spawn = () => {
    worker ??= new Worker(new URL("./js.worker.ts", import.meta.url), {
      type: "module",
    });
    return worker;
  };

  const post = <T>(payload: unknown, budget: number) =>
    new Promise<T>((resolve, reject) => {
      const w = spawn();
      const id = ++seq;
      const cleanup = () => {
        clearTimeout(timer);
        w.removeEventListener("message", onMessage);
        w.removeEventListener("error", onError);
      };
      const fail = (message: string) => {
        cleanup();
        // A worker that threw or hung is not reused; the next run gets a fresh one.
        w.terminate();
        if (worker === w) worker = null;
        reject(new Error(message));
      };
      const timer = setTimeout(
        () =>
          fail(
            `Run exceeded ${Math.round(budget / 1000)} s and was stopped. Check for an infinite loop.`,
          ),
        budget,
      );
      const onMessage = (
        e: MessageEvent<
          { id: number; error?: string } & Record<string, unknown>
        >,
      ) => {
        if (e.data.id !== id) return;
        if (typeof e.data.error === "string") {
          cleanup();
          reject(new Error(e.data.error));
          return;
        }
        cleanup();
        resolve(e.data as T);
      };
      const onError = (e: ErrorEvent) => fail(e.message || "Worker failed");
      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError);
      w.postMessage({ id, request: payload });
    });

  return {
    async run(request) {
      const started = Date.now();
      try {
        const { outcome } = await post<{ outcome: RunOutcome }>(
          { ...request, runner: "js" },
          timeoutMs,
        );
        return outcome;
      } catch (e) {
        return {
          results: [],
          passed: false,
          logs: [],
          durationMs: Date.now() - started,
          fatal: e instanceof Error ? e.message : String(e),
        };
      }
    },
    terminate() {
      worker?.terminate();
      worker = null;
    },
  };
}
