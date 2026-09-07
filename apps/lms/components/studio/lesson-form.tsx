"use client";

import { Badge } from "@repo/ui/components/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { Credits } from "./credits";
import { Choice, EditTrail, SaveRow, Text, Toggle } from "./fields";

/** A lesson's metadata. What it teaches is a pull request; this is not. */
export function LessonForm({ id }: { id: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const q = useQuery(trpc.studio.lesson.queryOptions({ id }));
  const save = useMutation(
    trpc.studio.updateLesson.mutationOptions({
      onSuccess: () => {
        setError(null);
        setSaved(true);
        qc.invalidateQueries({ queryKey: trpc.studio.pathKey() });
      },
      onError: (e) => setError(e.message),
    }),
  );
  if (q.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error)
    return <p className="text-sm text-destructive">{q.error.message}</p>;
  const { lesson, credits, edits } = q.data;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    save.mutate({
      id,
      title: str("title"),
      mode: (str("mode") || "foundation") as "foundation",
      isRequired: f.get("isRequired") === "1",
      isFree: f.get("isFree") === "1",
      durationMinutes: str("durationMinutes")
        ? Number(str("durationMinutes"))
        : null,
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/studio/courses/${lesson.course.slug}` as Route}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          {lesson.course.title}
        </Link>
        <Badge variant="outline" className="capitalize">
          {lesson.type}
        </Badge>
        <Link
          href={`/courses/${lesson.course.slug}/${lesson.slug}` as Route}
          className="ml-auto text-xs underline underline-offset-4"
        >
          View the lesson
        </Link>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          What this lesson teaches — its body, its quiz, its exercise — lives in
          the content repo and changes by pull request. Everything below is
          yours.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            name="title"
            label="Title"
            defaultValue={lesson.title}
            required
          />
          <Text
            name="durationMinutes"
            label="Minutes"
            type="number"
            defaultValue={
              lesson.durationMinutes ? String(lesson.durationMinutes) : ""
            }
            hint="Roughly how long this takes a learner."
          />
          <Choice
            name="mode"
            label="Mode"
            defaultValue={lesson.mode}
            options={[
              ["foundation", "Foundation"],
              ["industry", "Industry"],
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <Toggle
            name="isRequired"
            label="Required for completion"
            defaultChecked={lesson.isRequired}
          />
          <Toggle
            name="isFree"
            label="Free to read"
            defaultChecked={lesson.isFree}
          />
        </div>
        <SaveRow pending={save.isPending} error={error} saved={saved} />
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Credits</h2>
        <Credits subjectType="lesson" subjectId={lesson.id} credits={credits} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Recent changes</h2>
        <EditTrail edits={edits} />
      </section>
    </div>
  );
}
