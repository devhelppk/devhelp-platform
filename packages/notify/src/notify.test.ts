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

describe("email throttle", () => {
  it("keeps the in-app row and skips the email once a learner is over the cap", async () => {
    // Its own learner: the counter is keyed by user and the tests above have
    // already spent one of this run's emails.
    const [fresh] = (await db
      .insert(schema.users)
      .values({
        email: `throttle-${crypto.randomUUID()}@devhelp.test`,
        name: "Throttle",
      })
      .returning()) as unknown as [{ id: string }];
    const react = createElement("p", null, "x");
    const results: boolean[] = [];
    // The hourly cap is 4; the fifth email is skipped, the row is not.
    for (let i = 0; i < 6; i++) {
      const r = await notify({
        userId: fresh.id,
        kind: "moderation_decided",
        title: `Throttle ${i}`,
        dedupeKey: `throttle:${i}`,
        email: { to: "t@devhelp.test", subject: `s${i}`, react },
      });
      results.push(r.emailed);
      expect(r.created).toBe(true);
    }
    expect(results.filter(Boolean)).toHaveLength(4);
    expect(outbox).toHaveLength(4);
    // Every row landed even though two emails were dropped.
    expect(await unreadCount(fresh.id)).toBe(6);
    await db.delete(schema.users).where(eq(schema.users.id, fresh.id));
  });

  it("silent writes the row and sends nothing", async () => {
    resetOutbox();
    const r = await notify({
      userId: user.id,
      kind: "moderation_decided",
      title: "Quiet",
      dedupeKey: "quiet:1",
      silent: true,
      email: {
        to: "t@devhelp.test",
        subject: "s",
        react: createElement("p", null, "x"),
      },
    });
    expect(r).toMatchObject({ created: true, emailed: false });
    expect(outbox).toHaveLength(0);
  });
});
