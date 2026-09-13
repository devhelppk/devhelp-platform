import { auth } from "@repo/auth";
import { unreadCount } from "@repo/notify";
import { Button } from "@repo/ui/components/button";
import { Bell } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

/** Server-rendered unread count: no client bundle on every page; refreshes on navigation. */
export async function NotificationBell() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const n = await unreadCount(session.user.id);
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      aria-label={n ? `${n} unread notifications` : "Notifications"}
    >
      <Link href="/notifications" className="relative">
        <Bell aria-hidden="true" />
        {n ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {n > 99 ? "99+" : n}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
