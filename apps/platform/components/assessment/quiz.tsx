"use client";

import type { AppRouter, inferRouterOutputs } from "@repo/api";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

type QuizOut = inferRouterOutputs<AppRouter>["assessments"]["getQuiz"];
type SubmitOut = inferRouterOutputs<AppRouter>["assessments"]["submitQuiz"];
type Answer = string | string[];

export function Quiz({
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
  const qc = useQueryClient();
  const router = useRouter();
  const quiz = useQuery(
    trpc.assessments.getQuiz.queryOptions({ courseSlug, lessonSlug }),
  );
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<SubmitOut | null>(null);
  const submit = useMutation(
    trpc.assessments.submitQuiz.mutationOptions({
      onSuccess: async (r) => {
        setResult(r);
        await qc.invalidateQueries({
          queryKey: trpc.assessments.getQuiz.queryKey({
            courseSlug,
            lessonSlug,
          }),
        });
        router.refresh(); // sidebar ticks and course progress are server-rendered
      },
    }),
  );

  if (quiz.isPending)
    return <p className="text-sm text-muted-foreground">Loading quiz…</p>;
  if (quiz.error || !quiz.data)
    return (
      <p className="text-sm text-destructive">This quiz could not be loaded.</p>
    );
  const q = quiz.data;
  const answered = q.questions.filter((x) => {
    const a = answers[x.id];
    return Array.isArray(a) ? a.length > 0 : !!a;
  }).length;
  const locked = q.attemptsLeft === 0 && !result;

  const retry = () => {
    setResult(null);
    setAnswers({});
  };

  return (
    <section aria-labelledby="quiz-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="quiz-heading" className="text-lg font-semibold">
          Quiz
        </h2>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">Pass at {q.passScore}%</Badge>
          {q.bestScore !== null ? (
            <Badge variant="secondary">Best {q.bestScore}%</Badge>
          ) : null}
          {q.attemptsLeft !== null ? (
            <Badge variant="outline">
              {q.attemptsLeft} {q.attemptsLeft === 1 ? "attempt" : "attempts"}{" "}
              left
            </Badge>
          ) : null}
          {completed ? <Badge>Completed</Badge> : null}
        </div>
      </div>

      {result ? <ResultBanner result={result} /> : null}

      <ol className="flex flex-col gap-4">
        {q.questions.map((question, i) => {
          const per = result?.perQuestion.find(
            (p) => p.questionId === question.id,
          );
          return (
            <li key={question.id}>
              <Card
                className={cn(
                  per &&
                    (per.correct
                      ? "border-primary/60"
                      : "border-destructive/60"),
                )}
              >
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                    {question.prompt}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {question.points}{" "}
                      {question.points === 1 ? "point" : "points"}
                      {question.type === "multi" ? ", pick all that apply" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <QuestionInput
                    question={question}
                    value={answers[question.id]}
                    disabled={!!result || locked}
                    correctIds={per?.correctOptionIds}
                    onChange={(v) =>
                      setAnswers((a) => ({ ...a, [question.id]: v }))
                    }
                  />
                  {per ? (
                    <div
                      className="rounded-md bg-muted px-3 py-2 text-sm"
                      aria-live="polite"
                    >
                      <p
                        className={cn(
                          "font-medium",
                          per.correct ? "text-primary" : "text-destructive",
                        )}
                      >
                        {per.correct ? "Correct" : "Not quite"}
                      </p>
                      {per.feedback ? <p>{per.feedback}</p> : null}
                      {!per.correct && per.acceptedAnswers?.length ? (
                        <p>Accepted: {per.acceptedAnswers.join(", ")}</p>
                      ) : null}
                      {per.explanation ? (
                        <p className="text-muted-foreground">
                          {per.explanation}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result
            ? `Attempt ${result.attempt}: ${result.score}%`
            : `${answered} of ${q.questions.length} answered`}
        </p>
        {!signedIn ? (
          <Button
            onClick={() =>
              router.push(
                `/sign-in?callbackURL=${encodeURIComponent(`/courses/${courseSlug}/${lessonSlug}`)}` as Route,
              )
            }
          >
            Sign in to take the quiz
          </Button>
        ) : result ? (
          result.passed ? null : (
            <Button
              variant="outline"
              disabled={result.attemptsLeft === 0}
              onClick={retry}
            >
              {result.attemptsLeft === 0 ? "No attempts left" : "Try again"}
            </Button>
          )
        ) : (
          <Button
            disabled={
              answered < q.questions.length || submit.isPending || locked
            }
            onClick={() =>
              submit.mutate({
                courseSlug,
                lessonSlug,
                answers: Object.entries(answers).map(([questionId, value]) => ({
                  questionId,
                  value,
                })),
              })
            }
          >
            {submit.isPending
              ? "Grading…"
              : locked
                ? "No attempts left"
                : "Submit answers"}
          </Button>
        )}
      </div>
      {submit.error ? (
        <p role="alert" className="text-sm text-destructive">
          {submit.error.message}
        </p>
      ) : null}

      {q.attempts.length ? (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">
            Previous attempts ({q.attempts.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {q.attempts.map((a) => (
              <li key={a.attempt}>
                Attempt {a.attempt} scored {a.score}%
                {a.passed ? " and passed" : ""} on{" "}
                {new Date(a.submittedAt).toLocaleDateString("en-PK", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ResultBanner({ result }: { result: SubmitOut }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-4 py-3",
        result.passed
          ? "border-primary/60 bg-primary/5"
          : "border-destructive/60 bg-destructive/5",
      )}
    >
      <p className="font-medium">
        {result.passed ? "Passed" : "Not passed"} with {result.score}%, the pass
        mark is {result.passScore}%
      </p>
      <p className="text-sm text-muted-foreground">
        {result.courseCompleted
          ? "That was the last requirement. Course completed."
          : result.passed
            ? "Lesson completed."
            : result.attemptsLeft === 0
              ? "No attempts left. Re-read the lesson; the best score so far still counts."
              : "Review the feedback below and try again."}
      </p>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  disabled,
  correctIds,
  onChange,
}: {
  question: QuizOut["questions"][number];
  value: Answer | undefined;
  disabled: boolean;
  correctIds?: string[];
  onChange: (v: Answer) => void;
}) {
  if (question.type === "short") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`q-${question.id}`} className="sr-only">
          Your answer
        </Label>
        <Input
          id={`q-${question.id}`}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          placeholder="Type your answer"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  const multi = question.type === "multi";
  const chosen = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="sr-only">{question.prompt}</legend>
      {question.options.map((o) => {
        const id = `q-${question.id}-${o.id}`;
        const isCorrect = correctIds?.includes(o.id);
        return (
          <div
            key={o.id}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2",
              correctIds &&
                (isCorrect
                  ? "border-primary/60"
                  : chosen.has(o.id)
                    ? "border-destructive/60"
                    : ""),
            )}
          >
            {multi ? (
              <Checkbox
                id={id}
                checked={chosen.has(o.id)}
                onCheckedChange={(c) =>
                  onChange(
                    c
                      ? [...chosen, o.id]
                      : [...chosen].filter((x) => x !== o.id),
                  )
                }
              />
            ) : (
              <input
                id={id}
                type="radio"
                name={`q-${question.id}`}
                className="size-4 accent-primary"
                checked={chosen.has(o.id)}
                onChange={() => onChange(o.id)}
              />
            )}
            <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
              {o.text}
            </Label>
            {correctIds && isCorrect ? (
              <span className="text-xs text-primary">correct</span>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
