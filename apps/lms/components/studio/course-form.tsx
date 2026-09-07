"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { Credits } from "./credits";
import { Area, Choice, EditTrail, SaveRow, Text } from "./fields";

/**
 * A module heading is public and its only other source was `module.yaml`,
 * which no longer carries one — so it has to be editable here or every new
 * module renders as its slug for ever.
 */
function ModuleTitle({
  id,
  title,
  slug,
}: {
  id: string;
  title: string;
  slug: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation(
    trpc.studio.updateModule.mutationOptions({
      onSuccess: () => {
        setEditing(false);
        setError(null);
        qc.invalidateQueries({ queryKey: trpc.studio.pathKey() });
      },
      onError: (e) => setError(e.message),
    }),
  );
  if (!editing)
    return (
      <div className="flex items-center gap-2 bg-muted/40 px-4 py-2 text-xs font-medium">
        {title}
        {title === slug ? (
          <Badge variant="secondary" className="text-xs">
            No title yet
          </Badge>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto rounded-sm px-2 py-0.5 font-normal text-muted-foreground hover:bg-background"
        >
          Rename
        </button>
      </div>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        const next = String(
          new FormData(e.currentTarget).get("title") ?? "",
        ).trim();
        save.mutate({ id, title: next });
      }}
    >
      <Input
        name="title"
        defaultValue={title}
        className="h-8 max-w-xs"
        aria-label="Module title"
        required
        minLength={3}
      />
      <Button type="submit" size="sm" disabled={save.isPending}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </form>
  );
}

/** Everything about a course that the content repo no longer carries. */
export function CourseForm({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const q = useQuery(trpc.studio.course.queryOptions({ slug }));
  const save = useMutation(
    trpc.studio.updateCourse.mutationOptions({
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
  const { course, modules, lessons, credits, edits } = q.data;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    save.mutate({
      slug,
      title: str("title"),
      summary: str("summary"),
      description: str("description") || null,
      track: (str("track") || "technical") as "technical",
      level: (str("level") || "beginner") as "beginner",
      estimatedHours: str("estimatedHours")
        ? Number(str("estimatedHours"))
        : null,
      coverImageUrl: str("coverImageUrl") || null,
      isPublished: f.get("isPublished") === "1",
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {course.needsMetadata ? (
          <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            This course arrived from the content repo with only its slug. Give
            it a title and a summary, and it can be published.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            name="title"
            label="Title"
            defaultValue={course.title}
            required
          />
          <Text
            name="estimatedHours"
            label="Estimated hours"
            type="number"
            defaultValue={
              course.estimatedHours ? String(course.estimatedHours) : ""
            }
          />
          <Choice
            name="track"
            label="Track"
            defaultValue={course.track}
            options={[
              ["technical", "Technical"],
              ["career", "Career"],
            ]}
          />
          <Choice
            name="level"
            label="Level"
            defaultValue={course.level}
            options={[
              ["beginner", "Beginner"],
              ["intermediate", "Intermediate"],
              ["advanced", "Advanced"],
            ]}
          />
        </div>
        <Area
          name="summary"
          label="Summary"
          defaultValue={course.summary}
          hint="One or two sentences. This is what the catalogue shows."
        />
        <Area
          name="description"
          label="Description"
          rows={5}
          defaultValue={course.description ?? ""}
        />
        <Text
          name="coverImageUrl"
          label="Cover image URL"
          defaultValue={course.coverImageUrl ?? ""}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPublished"
            value="1"
            defaultChecked={course.isPublished}
            className="size-4 rounded border-input accent-brand-600"
          />
          Published — visible in the catalogue
        </label>
        <SaveRow pending={save.isPending} error={error} saved={saved} />
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Credits</h2>
        <Credits subjectType="course" subjectId={course.id} credits={credits} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">
          Lessons{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({lessons.length})
          </span>
        </h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Which lessons exist, and their order, come from the content repo.
          Their titles are yours.
        </p>
        <ul className="divide-y rounded-lg border">
          {modules.map((m) => (
            <li key={m.id} className="flex flex-col">
              <ModuleTitle id={m.id} title={m.title} slug={m.slug} />
              {lessons
                .filter((l) => l.moduleId === m.id)
                .map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm"
                  >
                    <Link
                      href={`/studio/lessons/${l.id}` as Route}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {l.title}
                    </Link>
                    <Badge variant="outline" className="text-xs capitalize">
                      {l.type}
                    </Badge>
                    {l.needsMetadata ? (
                      <Badge variant="secondary" className="text-xs">
                        No title yet
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {l.durationMinutes ? `${l.durationMinutes} min` : "—"}
                    </span>
                  </div>
                ))}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Recent changes</h2>
        <EditTrail edits={edits} />
      </section>
    </div>
  );
}
