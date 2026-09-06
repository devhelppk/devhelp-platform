import { and, count, eq, isNull, schema } from "@repo/database";
import { db } from "@repo/database";
import { sendEmail } from "@repo/email";
import type { ReactElement } from "react";

type Kind = (typeof schema.notificationKind.enumValues)[number];

export type NotifyInput = {
  userId: string;
  kind: Kind;
  title: string;
  body?: string;
  /** Internal path the row opens, e.g. "/moderate/<id>". */
  href?: string;
  subjectType?: string;
  subjectId?: string;
  /** One notification per (user, key): a repeat call is a no-op. */
  dedupeKey?: string;
  /** Sent at once when the kind emails (see `emailingKinds`); ignored otherwise. */
  email?: { to: string; subject: string; react: ReactElement };
};

/** Kinds that also send an email immediately. The digest (X4 P1) will take over the rest. */
export const emailingKinds: ReadonlySet<Kind> = new Set<Kind>([
  "mentor_application_decided",
  "moderation_decided",
  "org_invitation",
  "comment_accepted",
]);

/**
 * The only writer of `notifications`. Inserts the row (deduped on the key)
 * and, for kinds that email, sends the template right away and stamps
 * `emailed_at`. Email failures are logged, never thrown: the in-app row is
 * the record; mail is best effort.
 */
export async function notify(
  input: NotifyInput,
): Promise<{ id: string; created: boolean; emailed: boolean }> {
  const [row] = await db
    .insert(schema.notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing({
      target: [schema.notifications.userId, schema.notifications.dedupeKey],
    })
    .returning({ id: schema.notifications.id });
  if (!row) {
    const existing = await db.query.notifications.findFirst({
      where: and(
        eq(schema.notifications.userId, input.userId),
        eq(schema.notifications.dedupeKey, input.dedupeKey ?? ""),
      ),
      columns: { id: true },
    });
    return { id: existing?.id ?? "", created: false, emailed: false };
  }
  let emailed = false;
  if (input.email && emailingKinds.has(input.kind)) {
    try {
      await sendEmail(input.email);
      await db
        .update(schema.notifications)
        .set({ emailedAt: new Date() })
        .where(eq(schema.notifications.id, row.id));
      emailed = true;
    } catch (e) {
      console.error(
        `[notify] email for ${input.kind} to ${input.email.to} failed:`,
        e,
      );
    }
  }
  return { id: row.id, created: true, emailed };
}

export async function unreadCount(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt),
      ),
    );
  return r?.n ?? 0;
}
