export type FileMap = Record<string, string>;

export type TestResult = {
  name: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
};

export type RunOutcome = {
  results: TestResult[];
  passed: boolean;
  /** Captured console output, newest last. */
  logs: string[];
  durationMs: number;
  /** Set when the run itself failed (syntax error, timeout, runtime missing). */
  fatal?: string;
};

export type RunRequest = {
  runner: "js";
  /** Learner-editable files (starter with edits). */
  files: FileMap;
  /** Test files; imports resolve against `files` under `../starter/…` or `./…`. */
  testFiles: FileMap;
  timeoutMs?: number;
};
