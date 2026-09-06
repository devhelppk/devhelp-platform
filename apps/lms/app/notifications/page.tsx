import type { Metadata } from "next";
import type { Route } from "next";
import { api } from "@repo/api/server";
import { auth } from "@repo/auth";
import { Button } from "@repo/ui/components/button";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ago } from "@/components/moderation/labels";
import { Page } from "@/components/shell/site-header";
import { safePath } from "@/lib/safe-path";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?callbackURL=%2Fnotifications");
  const caller = await api(await headers());
  const { items } = await caller.notifications.list({ limit: 50 });
  const unread = items.filter((n) => !n.readAt).length;

  async function markAllRead() {
    "use server";
    const c = await api(await headers());
    await c.notifications.markAllRead();
    revalidatePath("/notifications");
  }
  async function open(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const href = String(formData.get("href") || "/notifications");
    const c = await api(await headers());
    await c.notifications.markRead({ id });
    revalidatePath("/notifications");
    redirect(safePath(href, "/notifications") as Route);
  }

  return (
    <Page callbackURL="/notifications">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              {unread ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread ? (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" size="sm">
                Mark all read
              </Button>
            </form>
          ) : null}
        </header>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Decisions on things you submit, replies, and
            invitations show up here.{" "}
            <Link
              href={"/courses" as Route}
              className="underline underline-offset-4"
            >
              Back to courses
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((n) => (
              <li key={n.id}>
                <form action={open}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="href" value={n.href ?? ""} />
                  <button
                    type="submit"
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2">
                      {!n.readAt ? (
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full bg-primary"
                        />
                      ) : null}
                      <span
                        className={n.readAt ? "text-sm" : "text-sm font-medium"}
                      >
                        {n.title}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {ago(n.createdAt)}
                      </span>
                    </span>
                    {n.body ? (
                      <span className="text-sm text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
