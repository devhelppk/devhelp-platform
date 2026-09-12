"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Label } from "@repo/ui/components/label";
import { Area, SaveRow, Text } from "./fields";

/** A path's metadata. Which courses it holds, and their order, come from the repo. */
export function PathForm({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const q = useQuery(trpc.studio.path.queryOptions({ slug }));
  const save = useMutation(
    trpc.studio.updatePath.mutationOptions({
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
  const { path } = q.data;

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
      isPublished: f.get("isPublished") === "1",
    });
  }

  return (
    /* Form left, the repo-owned course order beside it rather than beneath —
       the same shape as the course page. */
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {path.needsMetadata ? (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                This path arrived from the content repo with only its slug and
                its courses. Give it a title and a summary, and it can be
                published.
              </p>
            ) : null}
            <Text
              name="title"
              label="Title"
              defaultValue={path.title}
              required
            />
            <Area
              name="summary"
              label="Summary"
              defaultValue={path.summary}
              hint="What this path is for, and who should follow it."
            />
            <Area
              name="description"
              label="Description"
              rows={5}
              defaultValue={path.description ?? ""}
            />
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                name="isPublished"
                value="1"
                defaultChecked={path.isPublished}
              />
              Published — offered on the catalogue
            </Label>
            <SaveRow pending={save.isPending} error={error} saved={saved} />
          </form>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            Courses in order{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({path.pathCourses.length})
            </span>
          </CardTitle>
          <CardDescription>
            The curation itself lives in the content repo; changing it is a pull
            request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="divide-y rounded-lg border">
            {path.pathCourses.map((pc, i) => (
              <li key={pc.course.slug} className="flex gap-3 px-4 py-3 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {i + 1}.
                </span>
                {pc.course.title}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
