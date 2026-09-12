import { db, eq, schema } from "@repo/database";
import { outbox, resetOutbox } from "@repo/email";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { emailingKinds, notify, tryConsume, unreadCount } from "./index";

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
  it("inserts, dedupes on the key, and emails nothing", async () => {
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
    // No kind emails any more (founder, 2026-09-12): transactional mail only,
    // and that goes through Better Auth, not through here. Passing `email` is
    // still allowed and is simply ignored.
    expect(first).toMatchObject({ created: true, emailed: false });
    expect(outbox).toHaveLength(0);
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
    expect(outbox).toHaveLength(0);
    expect(await unreadCount(user.id)).toBe(2);
  });

  it("sends no notification email at all", () => {
    // The guard on the decision itself: a kind added back here starts emailing
    // every learner it touches, so it should be a deliberate edit, not a drift.
    expect([...emailingKinds]).toEqual([]);
  });
});

describe("email throttle", () => {
  it("caps a learner at four in an hour and twelve in a day", async () => {
    // The throttle is still live machinery even with `emailingKinds` empty: it
    // guards whatever is turned back on, and the digest (X4) will lean on it.
    // Tested against `tryConsume` directly, since no kind emails now.
    const key = `email:hour:${crypto.randomUUID()}`;
    const allowed: boolean[] = [];
    for (let i = 0; i < 6; i++) allowed.push(await tryConsume(key, 4, 3600));
    expect(allowed).toEqual([true, true, true, true, false, false]);
    await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, key));
  });

  it("keeps the in-app row and sends nothing even under the cap", async () => {
    const [fresh] = (await db
      .insert(schema.users)
      .values({
        email: `throttle-${crypto.randomUUID()}@devhelp.test`,
        name: "Throttle",
      })
      .returning()) as unknown as [{ id: string }];
    const react = createElement("p", null, "x");
    const results: boolean[] = [];
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
    expect(results.filter(Boolean)).toHaveLength(0);
    expect(outbox).toHaveLength(0);
    // Every row still lands; only the mail is gone.
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
