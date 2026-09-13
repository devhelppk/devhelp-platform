"use client";

import type { AppRouter, inferRouterOutputs } from "@repo/api";
import {
  createRunner,
  type RunOutcome,
  type Runner,
} from "@repo/exercise-runner";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, Play, RotateCcw, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { CodeEditor } from "./code-editor";

type ExerciseOut = inferRouterOutputs<AppRouter>["assessments"]["getExercise"];

export function Exercise({
  courseSlug,
  lessonSlug,
  signedIn,
  completed,
}: {
  courseSlug: string;
  lessonSlug: string;
  signedIn: boolean;
  completed: boolean;
}) {
  const trpc = useTRPC();
  const ex = useQuery(
    trpc.assessments.getExercise.queryOptions({ courseSlug, lessonSlug }),
  );
  if (ex.isPending)
    return <p className="text-sm text-muted-foreground">Loading exercise…</p>;
  if (ex.error || !ex.data)
    return (
      <p className="text-sm text-destructive">
        This exercise could not be loaded.
      </p>
    );
  return (
    <ExerciseWorkspace
      data={ex.data}
      courseSlug={courseSlug}
      lessonSlug={lessonSlug}
      signedIn={signedIn}
      completed={completed}
    />
  );
}

function ExerciseWorkspace({
  data,
  courseSlug,
  lessonSlug,
  signedIn,
  completed,
}: {
  data: ExerciseOut;
  courseSlug: string;
  lessonSlug: string;
  signedIn: boolean;
  completed: boolean;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const draftKey = `devhelp:exercise:${data.exerciseId}:v${data.version}`;
  const fileNames = useMemo(
    () => Object.keys(data.starterFiles),
    [data.starterFiles],
  );
  const [files, setFiles] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(draftKey);
        if (saved)
          return {
            ...data.starterFiles,
            ...(JSON.parse(saved) as Record<string, string>),
          };
      } catch {
        /* ignore */
      }
    }
    return data.lastSubmission?.files ?? data.starterFiles;
  });
  const [active, setActive] = useState(fileNames[0] ?? "");
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const runnerRef = useRef<Runner | null>(null);

  useEffect(() => {
    const r = createRunner();
    runnerRef.current = r;
    return () => r.terminate();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(files));
    } catch {
      /* storage unavailable */
    }
  }, [draftKey, files]);

  const submit = useMutation(
    trpc.assessments.submitExercise.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries({
          queryKey: trpc.assessments.getExercise.queryKey({
            courseSlug,
            lessonSlug,
          }),
        });
        router.refresh();
      },
    }),
  );

  async function run() {
    if (!runnerRef.current) return;
    setRunning(true);
    setOutcome(null);
    const result = await runnerRef.current.run({
      files,
      testFiles: data.testFiles,
    });
    setOutcome(result);
    setRunning(false);
  }

  const reset = () => {
    setFiles(data.starterFiles);
    setOutcome(null);
  };

  const testNames = Object.keys(data.testFiles);
  const tabs = [
    ...fileNames.map((name) => ({ name, readOnly: false })),
    ...testNames.map((name) => ({ name, readOnly: true })),
  ];
  const activeTab = tabs.find((t) => t.name === active) ?? tabs[0];
  const submitted = data.lastSubmission;

  return (
    <section aria-labelledby="exercise-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="exercise-heading" className="text-lg font-semibold">
          Exercise
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">
            {data.language}
          </Badge>
          <Badge variant="outline">Runs in your browser</Badge>
          {completed ? (
            <Badge>Completed</Badge>
          ) : submitted ? (
            <Badge variant="secondary">
              Last run: {submitted.passed ? "passed" : "failed"}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border">
        <div
          className="flex [scrollbar-width:none] items-center gap-1 overflow-x-auto border-b bg-muted px-2 text-sm"
          role="tablist"
          aria-label="Files"
        >
          {tabs.map((t) => (
            <button
              key={t.name}
              role="tab"
              aria-selected={active === t.name}
              onClick={() => setActive(t.name)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap",
                active === t.name
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.name}
              {t.readOnly ? (
                <Lock className="size-3" aria-label="read only" />
              ) : null}
            </button>
          ))}
          <span className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={reset}
            aria-label="Reset to starter code"
          >
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
        </div>
        {activeTab ? (
          <CodeEditor
            key={activeTab.name}
            value={
              activeTab.readOnly
                ? (data.testFiles[activeTab.name] ?? "")
                : (files[activeTab.name] ?? "")
            }
            language={data.language}
            readOnly={activeTab.readOnly}
            ariaLabel={
              activeTab.readOnly
                ? `${activeTab.name} (read only)`
                : `Editor for ${activeTab.name}`
            }
            onChange={
              activeTab.readOnly
                ? undefined
                : (v) => setFiles((f) => ({ ...f, [activeTab.name]: v }))
            }
          />
        ) : null}
        {activeTab?.readOnly ? (
          <p className="border-t bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            Tests are read only. They describe what "done" means; edit the other
            files to make them pass.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={running}>
          <Play aria-hidden="true" /> {running ? "Running…" : "Run tests"}
        </Button>
        {outcome?.passed ? (
          !signedIn ? (
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/sign-in?callbackURL=${encodeURIComponent(`/courses/${courseSlug}/${lessonSlug}`)}` as Route,
                )
              }
            >
              Sign in to record this
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={submit.isPending || completed}
              onClick={() =>
                submit.mutate({
                  courseSlug,
                  lessonSlug,
                  files,
                  results: outcome.results,
                  passed: outcome.passed,
                  durationMs: outcome.durationMs,
                })
              }
            >
              {completed
                ? "Recorded"
                : submit.isPending
                  ? "Saving…"
                  : "Submit and complete lesson"}
            </Button>
          )
        ) : null}
        {outcome ? (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {outcome.results.filter((r) => r.passed).length}/
            {outcome.results.length} passed in {outcome.durationMs} ms
          </span>
        ) : null}
      </div>

      {submit.error ? (
        <p role="alert" className="text-sm text-destructive">
          {submit.error.message}
        </p>
      ) : null}
      {submit.isSuccess ? (
        <p
          role="status"
          className="rounded-lg border border-primary/60 bg-primary/5 px-4 py-3 text-sm"
        >
          {submit.data.courseCompleted
            ? "Recorded. That was the last requirement: course completed."
            : "Recorded. Lesson completed."}
        </p>
      ) : null}

      {outcome ? (
        <div className="flex flex-col gap-2 rounded-lg border">
          {outcome.fatal ? (
            <p className="px-4 py-3 text-sm text-destructive">
              {outcome.fatal}
            </p>
          ) : null}
          <ul className="divide-y">
            {outcome.results.map((r) => (
              <li key={r.name} className="flex gap-3 px-4 py-2 text-sm">
                {r.passed ? (
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-label="Passed"
                  />
                ) : (
                  <X
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-label="Failed"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  {r.error ? (
                    <pre className="mt-1 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                      {r.error}
                    </pre>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {outcome.logs.length ? (
            <details className="border-t px-4 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Console ({outcome.logs.length})
              </summary>
              <pre className="mt-2 overflow-x-auto font-mono whitespace-pre-wrap">
                {outcome.logs.join("\n")}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
