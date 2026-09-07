import { and, db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";
import type { SalaryLevel } from "./levels";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User;
let orgId: string, roleId: string, otherRoleId: string, cityId: string;
const slug = `payco-${run}`;
const made: string[] = [];

const as = (u: User | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({ user: u, session: { id: "s" } } as unknown as Context["session"])
      : null,
  } as Context);

async function user(name: string) {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${name}-${run}@devhelp.test`,
      name,
      emailVerified: true,
    })
    .returning();
  made.push(u!.id);
  return u!;
}

/** One salary point from a fresh contributor, so the one-per-person rule holds. */
async function point(
  n: number,
  amount: number,
  extra: Partial<{
    currency: "PKR" | "USD";
    period: "monthly" | "yearly";
    level: SalaryLevel;
    cityId: string;
    roleId: string;
  }> = {},
) {
  const u = await user(`pay-${n}`);
  return as(u).contributions.submitSalary({
    slug,
    roleId: extra.roleId ?? roleId,
    level: extra.level,
    cityId: extra.cityId,
    employmentType: "full_time",
    amount,
    currency: extra.currency ?? "PKR",
    period: extra.period ?? "monthly",
    year: 2026,
  });
}

beforeAll(async () => {
  admin = await user("pay-admin");
  await db
    .update(schema.users)
    .set({ role: "admin" })
    .where(eq(schema.users.id, admin.id));
  admin = (await db.query.users.findFirst({
    where: eq(schema.users.id, admin.id),
  }))!;
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `Payco ${run}`,
      slug,
      kind: "company",
      createdAt: new Date(),
    })
    .returning();
  orgId = org!.id;
  await db.insert(schema.companyProfiles).values({
    organizationId: orgId,
    status: "published",
  });
  // The test owns its rate: `fx:refresh` needs the network and never runs in
  // CI, so relying on a row being there would fail there and pass locally.
  // Dated today, because `latestUsdToPkr` treats anything older than a
  // fortnight as stale (S10c) — a fixed past date passed locally only because
  // a real refresh had left a fresher row in the developer's database.
  await db
    .insert(schema.fxRates)
    .values({
      base: "USD",
      quote: "PKR",
      rate: "280.0000",
      asOf: new Date().toISOString().slice(0, 10),
      source: "test",
    })
    .onConflictDoUpdate({
      target: [schema.fxRates.base, schema.fxRates.quote, schema.fxRates.asOf],
      set: { rate: "280.0000", source: "test" },
    });
  const roles = await db.query.jobRoles.findMany({ limit: 2 });
  roleId = roles[0]!.id;
  otherRoleId = roles[1]!.id;
  cityId = (await db.query.cities.findFirst())!.id;
});

afterAll(async () => {
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, orgId));
  for (const id of made)
    await db.delete(schema.users).where(eq(schema.users.id, id));
});

describe("salary aggregates", () => {
  it("shows nothing below five reports and appears on the fifth", async () => {
    for (const n of [1, 2, 3, 4]) await point(n, 100_000 + n * 10_000);
    expect((await as(null).companies.salaries({ slug })).roles).toHaveLength(0);
    await point(5, 200_000);
    const after = await as(null).companies.salaries({ slug });
    expect(after.roles).toHaveLength(1);
    expect(after.roles[0]!.n).toBe(5);
  });

  it("withholds the middle half until eight reports", async () => {
    // At n = 5 `percentile_cont` lands on the 2nd, 3rd and 4th raw values, so
    // publishing all three would publish three of those five people's pay.
    const [row] = (await as(null).companies.salaries({ slug })).roles;
    expect(row!.n).toBe(5);
    expect(row!.p25).toBeNull();
    expect(row!.p75).toBeNull();
    expect(row!.median).not.toBeNull();
  });

  it("rounds every published figure so it is not anybody's exact pay", async () => {
    // 111,111 / 122,222 / 133,333 / 144,444 / 155,555: the median lands on the
    // middle one, and rounding to the nearest 5,000 must move it off that value.
    const odd = `odd-${run}`;
    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: `Odd ${run}`,
        slug: odd,
        kind: "company",
        createdAt: new Date(),
      })
      .returning();
    await db
      .insert(schema.companyProfiles)
      .values({ organizationId: org!.id, status: "published" });
    const amounts = [111_111, 122_222, 133_333, 144_444, 155_555];
    for (const [i, a] of amounts.entries()) {
      const u = await user(`odd-${i}`);
      await as(u).contributions.submitSalary({
        slug: odd,
        roleId,
        employmentType: "full_time",
        amount: a,
        currency: "PKR",
        period: "monthly",
        year: 2026,
      });
    }
    const [row] = (await as(null).companies.salaries({ slug: odd })).roles;
    expect(row!.n).toBe(5);
    // Not the raw middle value, and a multiple of the 5,000 rupee step.
    expect(row!.median).not.toBe(133_333 * 100);
    expect(row!.median! % (5_000 * 100)).toBe(0);
    for (const a of amounts) expect(row!.median).not.toBe(a * 100);
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, org!.id));
  });

  it("computes the quartiles in Postgres once there are eight reports", async () => {
    for (const n of [21, 22, 23] as const) await point(n, 200_000);
    const row = (await as(null).companies.salaries({ slug })).roles.find(
      (r) => r.currency === "PKR",
    )!;
    expect(row.n).toBe(8);
    expect(row.p25).not.toBeNull();
    expect(row.p75).not.toBeNull();
    expect(row.p25! % (5_000 * 100)).toBe(0);
    expect(row.p75! % (5_000 * 100)).toBe(0);
  });

  it("leaves internships and old figures out of the staff aggregate", async () => {
    const before = (await as(null).companies.salaries({ slug })).roles.find(
      (r) => r.currency === "PKR",
    )!;
    for (const n of [31, 32, 33, 34, 35] as const) {
      const u = await user(`extra-${n}`);
      await as(u).contributions.submitSalary({
        slug,
        roleId,
        employmentType: n < 34 ? "internship" : "full_time",
        amount: 20_000,
        currency: "PKR",
        period: "monthly",
        // The two full-time ones are old enough to fall outside the window.
        year: n < 34 ? 2026 : 2019,
      });
    }
    const after = (await as(null).companies.salaries({ slug })).roles.find(
      (r) => r.currency === "PKR",
    )!;
    expect(after.n).toBe(before.n);
    expect(after.median).toBe(before.median);
  });

  it("never exposes an individual amount or an author", async () => {
    const payload = JSON.stringify(await as(null).companies.salaries({ slug }));
    expect(payload).not.toContain("amountMinor");
    expect(payload).not.toContain("authorId");
    for (const id of made) expect(payload).not.toContain(id);
  });

  it("keeps currencies apart and converts only as an aid", async () => {
    // Captured rather than hard-coded, so this does not depend on how many
    // points the tests above happen to have added.
    const pkrBefore = (await as(null).companies.salaries({ slug })).roles.find(
      (r) => r.currency === "PKR",
    )!;
    for (const n of [6, 7, 8, 9, 10])
      await point(n, 3000 + n * 100, { currency: "USD" });
    const { roles, fx } = await as(null).companies.salaries({ slug });
    const byCurrency = Object.fromEntries(roles.map((r) => [r.currency, r]));
    expect(Object.keys(byCurrency).sort()).toEqual(["PKR", "USD"]);
    // 3,600 to 4,000 in hundreds: the median is 3,800, already a multiple of
    // the 50 dollar step, so rounding leaves it alone.
    expect(byCurrency.USD!.median).toBe(3800 * 100);
    expect(byCurrency.USD!.median! % (50 * 100)).toBe(0);
    // The PKR row is untouched by the USD ones.
    expect(byCurrency.PKR!.n).toBe(pkrBefore.n);
    expect(byCurrency.PKR!.median).toBe(pkrBefore.median);
    expect(fx?.rate).toBeGreaterThan(0);
  });

  it("normalises a yearly figure into the monthly aggregate", async () => {
    // Five yearly reports of 1,200,000 are five monthly 100,000s.
    for (const n of [11, 12, 13, 14, 15])
      await point(n, 1_200_000, { period: "yearly", roleId: otherRoleId });
    const row = (await as(null).companies.salaries({ slug })).roles.find(
      (r) => r.roleId === otherRoleId,
    );
    expect(row!.median).toBe(100_000 * 100);
  });

  it("breaks down by level and city only once a cell clears the floor", async () => {
    const before = await as(null).companies.salaries({ slug });
    expect(before.detail.filter((d) => d.level === "Senior")).toHaveLength(0);
    for (const n of [16, 17, 18, 19])
      await point(n, 300_000, { level: "Senior", cityId });
    expect(
      (await as(null).companies.salaries({ slug })).detail.filter(
        (d) => d.level === "Senior",
      ),
    ).toHaveLength(0);
    await point(20, 300_000, { level: "Senior", cityId });
    const cells = (await as(null).companies.salaries({ slug })).detail.filter(
      (d) => d.level === "Senior",
    );
    expect(cells).toHaveLength(1);
    expect(cells[0]!.n).toBe(5);
  });
});

describe("submitting pay", () => {
  it("publishes at once, unverified, with a queue item for the admin", async () => {
    const u = await user("pay-fresh");
    const { id } = await as(u).contributions.submitSalary({
      slug,
      roleId,
      employmentType: "full_time",
      amount: 150_000,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    const row = await db.query.salaryPoints.findFirst({
      where: eq(schema.salaryPoints.id, id),
    });
    expect(row!.status).toBe("published");
    expect(row!.verifiedAt).toBeNull();
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "salary_point"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    expect(item?.status).toBe("pending");
    await as(admin).moderation.decide({ id: item!.id, action: "approve" });
    const checked = await db.query.salaryPoints.findFirst({
      where: eq(schema.salaryPoints.id, id),
    });
    expect(checked!.verifiedAt).toBeInstanceOf(Date);
    expect(checked!.status).toBe("published");
  });

  it("drops a hidden point from the aggregate and keeps it hidden on an edit", async () => {
    const u = await user("pay-hidden");
    const { id } = await as(u).contributions.submitSalary({
      slug,
      roleId,
      employmentType: "full_time",
      amount: 900_000,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    const before = (await as(null).companies.salaries({ slug })).roles.find(
      (r) => r.roleId === roleId && r.currency === "PKR",
    )!;
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "salary_point"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    await as(admin).moderation.decide({
      id: item!.id,
      action: "hide",
      reason: "Implausible figure.",
    });
    const after = (await as(null).companies.salaries({ slug })).roles.find(
      (r) => r.roleId === roleId && r.currency === "PKR",
    )!;
    expect(after.n).toBe(before.n - 1);
    // Resubmitting must not put it back on the page.
    await as(u).contributions.submitSalary({
      slug,
      roleId,
      employmentType: "full_time",
      amount: 900_000,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    const row = await db.query.salaryPoints.findFirst({
      where: eq(schema.salaryPoints.id, id),
    });
    expect(row!.status).toBe("hidden");
  });

  it("keeps one point per company per person", async () => {
    const u = await user("pay-once");
    await as(u).contributions.submitSalary({
      slug,
      roleId,
      employmentType: "full_time",
      amount: 100_000,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    await as(u).contributions.submitSalary({
      slug,
      roleId,
      employmentType: "full_time",
      amount: 180_000,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    const rows = await db.query.salaryPoints.findMany({
      where: and(
        eq(schema.salaryPoints.organizationId, orgId),
        eq(schema.salaryPoints.authorId, u.id),
      ),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountMinor).toBe(180_000 * 100);
  });

  it("shows a contributor their own figure and nobody else's", async () => {
    const u = await user("pay-mine");
    await as(u).contributions.submitSalary({
      slug,
      roleId,
      employmentType: "full_time",
      amount: 123_456,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    const mine = await as(u).contributions.mine();
    expect(mine.salaries).toHaveLength(1);
    expect(mine.salaries[0]!.amountMinor).toBe(123_456 * 100);
    // Somebody else's list never carries it.
    const other = await user("pay-nosy");
    expect((await as(other).contributions.mine()).salaries).toHaveLength(0);
  });

  it("refuses a future year and an absurd amount", async () => {
    const u = await user("pay-bad");
    const base = {
      slug,
      roleId,
      employmentType: "full_time" as const,
      currency: "PKR" as const,
      period: "monthly" as const,
    };
    await expect(
      as(u).contributions.submitSalary({
        ...base,
        amount: 100_000,
        year: 2099,
      }),
    ).rejects.toThrow(/has not happened yet/);
    await expect(
      as(u).contributions.submitSalary({
        ...base,
        amount: 500_000_000,
        year: 2026,
      }),
    ).rejects.toThrow();
    await expect(
      as(u).contributions.submitSalary({ ...base, amount: -1, year: 2026 }),
    ).rejects.toThrow();
  });
});
