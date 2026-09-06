import { db, eq, schema } from "@repo/database";
import { outbox, resetOutbox } from "@repo/email";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { notify, unreadCount } from "./index";

let user: { id: string };
beforeAll(async () => {
  [user] = (await db
    .insert(schema.users)
    .values({
      email: `notify-${crypto.randomUUID()}@devhelp.test`,
      name: "Notify",
    })
    .returning()) as unknown as [{ id: string }];
});
afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
});
beforeEach(() => resetOutbox());

describe("notify", () => {
  it("inserts, dedupes on the key, and emails only kinds that ask for it", async () => {
    const first = await notify({
      userId: user.id,
      kind: "moderation_decided",
      title: "Your review is live",
      dedupeKey: "decided:1",
      email: {
        to: "n@devhelp.test",
        subject: "Live",
        react: createElement("p", null, "hi"),
      },
    });
    expect(first).toMatchObject({ created: true, emailed: true });
    expect(outbox).toHaveLength(1);
    const again = await notify({
      userId: user.id,
      kind: "moderation_decided",
      title: "dup",
      dedupeKey: "decided:1",
    });
    expect(again).toMatchObject({
      id: first.id,
      created: false,
      emailed: false,
    });
    const quiet = await notify({
      userId: user.id,
      kind: "role_changed",
      title: "You are a mentor",
      email: {
        to: "n@devhelp.test",
        subject: "x",
        react: createElement("p", null, "x"),
      },
    });
    expect(quiet.emailed).toBe(false);
    expect(outbox).toHaveLength(1);
    expect(await unreadCount(user.id)).toBe(2);
  });
});
