"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTRPC } from "@/lib/trpc/client";

type Initial = {
  handle: string | null;
  profilePublic: boolean;
  bio: string | null;
  links: { github?: string; website?: string; linkedin?: string } | null;
};

/** Public profile settings on the account page (X5). */
export function ProfileForm({
  initial,
  lmsUrl,
}: {
  initial: Initial;
  lmsUrl: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const [isPublic, setPublic] = useState(initial.profilePublic);
  const [handle, setHandle] = useState(initial.handle ?? "");
  const [note, setNote] = useState<string | null>(null);
  const save = useMutation(
    trpc.account.updatePublicProfile.mutationOptions({
      onSuccess: async (r) => {
        setNote(
          r.profilePublic && r.handle
            ? `Saved. Your profile is live at ${lmsUrl}/u/${r.handle}`
            : "Saved. Your profile is private.",
        );
        await qc.invalidateQueries({ queryKey: trpc.account.me.queryKey() });
        router.refresh();
      },
      onError: (e) => setNote(e.message),
    }),
  );
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const links: Record<string, string> = {};
    for (const k of ["github", "website", "linkedin"]) {
      const v = String(f.get(k) ?? "").trim();
      if (v) links[k] = v;
    }
    save.mutate({
      handle: handle.trim() || undefined,
      profilePublic: isPublic,
      bio: String(f.get("bio") ?? "").trim() || undefined,
      links: Object.keys(links).length ? links : undefined,
    });
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">Public profile</h2>
      <div className="flex items-center gap-3">
        <Switch
          id="profile-public"
          checked={isPublic}
          onCheckedChange={setPublic}
          aria-label="Make my profile public"
        />
        <Label htmlFor="profile-public">
          {isPublic
            ? "Public: anyone with the link can see it"
            : "Private (default)"}
        </Label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="handle">Handle</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {lmsUrl.replace(/^https?:\/\//, "")}/u/
          </span>
          <Input
            id="handle"
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            placeholder="ayesha-k"
            maxLength={30}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          3 to 30 lowercase letters, digits, or hyphens. Needed before going
          public.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          rows={2}
          maxLength={280}
          defaultValue={initial.bio ?? ""}
          placeholder="One or two lines about what you do or want to do."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="github">GitHub handle</Label>
          <Input
            id="github"
            name="github"
            defaultValue={initial.links?.github ?? ""}
            placeholder="octocat"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            name="website"
            type="url"
            defaultValue={initial.links?.website ?? ""}
            placeholder="https://"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="linkedin">LinkedIn</Label>
          <Input
            id="linkedin"
            name="linkedin"
            type="url"
            defaultValue={initial.links?.linkedin ?? ""}
            placeholder="https://linkedin.com/in/"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
        {initial.profilePublic && initial.handle ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/u/${initial.handle}` as Route}>
              View public profile
            </Link>
          </Button>
        ) : null}
        {note ? (
          <span role="status" className="text-sm text-muted-foreground">
            {note}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Certificates show the name you had when they were issued; changing your
        name does not change issued certificates.
      </p>
    </form>
  );
}
