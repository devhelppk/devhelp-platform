"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: unknown) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};

/**
 * YouTube lesson: progress tick every 15 s while playing, completion when the
 * video ends. Idempotency keys are stable per lesson so retries never double-count.
 */
export function VideoPlayer({
  courseSlug,
  lessonSlug,
  videoId,
  title,
  completed,
  signedIn,
}: {
  courseSlug: string;
  lessonSlug: string;
  videoId: string;
  title: string;
  completed: boolean;
  signedIn: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [done, setDone] = useState(completed);
  const progressed = useMutation(
    trpc.learning.lessonProgressed.mutationOptions(),
  );
  const started = useMutation(trpc.learning.lessonStarted.mutationOptions());
  const finished = useMutation(
    trpc.learning.lessonCompleted.mutationOptions({
      onSuccess: () => {
        setDone(true);
        void qc.invalidateQueries({ queryKey: trpc.learning.pathKey() });
        // The sidebar ticks and course progress are server-rendered; refresh them in place.
        router.refresh();
      },
    }),
  );

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let player: YTPlayer | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let active = true;
    // Mount-unique prefix: a per-mount counter alone would collide with keys from earlier sessions.
    const session = crypto.randomUUID().slice(0, 8);
    let tick = 0;
    const init = () => {
      if (!active) return; // effect already cleaned up (StrictMode double-run, fast navigation)
      player = new window.YT!.Player(el, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            const { PLAYING, ENDED } = window.YT!.PlayerState;
            if (!signedIn) return;
            if (e.data === PLAYING) {
              started.mutate({ courseSlug, lessonSlug });
              timer ??= setInterval(() => {
                if (!player) return;
                const pos = Math.floor(player.getCurrentTime());
                const pct = Math.min(
                  99,
                  Math.floor((pos / Math.max(1, player.getDuration())) * 100),
                );
                progressed.mutate({
                  courseSlug,
                  lessonSlug,
                  percent: pct,
                  positionSeconds: pos,
                  nonce: `${session}-${tick++}`,
                });
              }, 15_000);
            } else if (timer) {
              clearInterval(timer);
              timer = undefined;
            }
            if (e.data === ENDED && !done)
              finished.mutate({ courseSlug, lessonSlug });
          },
        },
      });
    };
    if (window.YT?.Player) init();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        init();
      };
      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
      ) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.async = true;
        document.head.appendChild(s);
      }
    }
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      player?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, signedIn]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-video w-full overflow-hidden rounded-lg border bg-muted bg-cover bg-center"
        // Poster while the player script loads, so the box is never blank.
        style={{
          backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)`,
        }}
      >
        <div ref={host} title={title} className="h-full w-full" />
      </div>
      <p className="text-xs text-muted-foreground">
        {done
          ? "Completed."
          : signedIn
            ? "Watch to the end to complete this lesson."
            : "Sign in to track your progress."}
      </p>
    </div>
  );
}
