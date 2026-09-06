import type { TestResult } from "./types.ts";

/**
 * A deliberately small vitest-compatible test API: describe/it/test/expect
 * with the matchers lesson tests actually use. It runs in a Worker in the
 * browser and in Node for content:check, so content authors get the same
 * behaviour in both. Anything outside this subset fails at content-check.
 */
type Fn = () => void | Promise<void>;
type Registered = { name: string; fn: Fn };

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

function fmt(v: unknown): string {
  try {
    if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    return (
      JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? `${x}n` : x)) ??
      String(v)
    );
  } catch {
    return String(v);
  }
}

export function deepEqual(a: unknown, b: unknown, strict = false): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((x, i) => deepEqual(x, b[i], strict))
    );
  }
  if (a instanceof Map && b instanceof Map) {
    return (
      a.size === b.size &&
      [...a].every(([k, v]) => b.has(k) && deepEqual(v, b.get(k), strict))
    );
  }
  if (a instanceof Set && b instanceof Set)
    return a.size === b.size && [...a].every((x) => b.has(x));
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  if (strict && Object.getPrototypeOf(ao) !== Object.getPrototypeOf(bo))
    return false;
  const ak = Object.keys(ao).filter((k) => strict || ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => strict || bo[k] !== undefined);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => k in bo && deepEqual(ao[k], bo[k], strict));
}

function matchesObject(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== "object")
    return deepEqual(actual, expected);
  if (actual === null || typeof actual !== "object") return false;
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((e, i) => matchesObject(actual[i], e))
    );
  }
  const eo = expected as Record<string, unknown>;
  const ao = actual as Record<string, unknown>;
  return Object.keys(eo).every((k) => k in ao && matchesObject(ao[k], eo[k]));
}

function createMatchers(actual: unknown, negate: boolean) {
  const check = (pass: boolean, message: string) => {
    if (pass === negate)
      throw new AssertionError(
        negate ? message.replace("expected", "expected not") : message,
      );
  };
  const m = {
    toBe: (e: unknown) =>
      check(Object.is(actual, e), `expected ${fmt(actual)} to be ${fmt(e)}`),
    toEqual: (e: unknown) =>
      check(deepEqual(actual, e), `expected ${fmt(actual)} to equal ${fmt(e)}`),
    toStrictEqual: (e: unknown) =>
      check(
        deepEqual(actual, e, true),
        `expected ${fmt(actual)} to strictly equal ${fmt(e)}`,
      ),
    toMatchObject: (e: unknown) =>
      check(
        matchesObject(actual, e),
        `expected ${fmt(actual)} to match ${fmt(e)}`,
      ),
    toContain: (e: unknown) => {
      const ok =
        typeof actual === "string"
          ? actual.includes(String(e))
          : Array.isArray(actual)
            ? actual.some((x) => Object.is(x, e))
            : false;
      check(ok, `expected ${fmt(actual)} to contain ${fmt(e)}`);
    },
    toHaveLength: (n: number) =>
      check(
        (actual as { length?: number })?.length === n,
        `expected ${fmt(actual)} to have length ${n}`,
      ),
    toBeTruthy: () => check(!!actual, `expected ${fmt(actual)} to be truthy`),
    toBeFalsy: () => check(!actual, `expected ${fmt(actual)} to be falsy`),
    toBeNull: () =>
      check(actual === null, `expected ${fmt(actual)} to be null`),
    toBeUndefined: () =>
      check(actual === undefined, `expected ${fmt(actual)} to be undefined`),
    toBeDefined: () =>
      check(actual !== undefined, `expected value to be defined`),
    toBeGreaterThan: (n: number) =>
      check(
        (actual as number) > n,
        `expected ${fmt(actual)} to be greater than ${n}`,
      ),
    toBeGreaterThanOrEqual: (n: number) =>
      check((actual as number) >= n, `expected ${fmt(actual)} to be >= ${n}`),
    toBeLessThan: (n: number) =>
      check(
        (actual as number) < n,
        `expected ${fmt(actual)} to be less than ${n}`,
      ),
    toBeLessThanOrEqual: (n: number) =>
      check((actual as number) <= n, `expected ${fmt(actual)} to be <= ${n}`),
    toBeCloseTo: (n: number, digits = 2) =>
      check(
        Math.abs((actual as number) - n) < Math.pow(10, -digits) / 2,
        `expected ${fmt(actual)} to be close to ${n}`,
      ),
    toBeInstanceOf: (c: abstract new (...args: never[]) => unknown) =>
      check(
        actual instanceof c,
        `expected ${fmt(actual)} to be an instance of ${c.name}`,
      ),
    toThrow: (expected?: string | RegExp) => {
      if (typeof actual !== "function")
        throw new AssertionError("expected a function to test for throwing");
      let threw: unknown = undefined;
      let did = false;
      try {
        (actual as () => unknown)();
      } catch (e) {
        did = true;
        threw = e;
      }
      const msg = threw instanceof Error ? threw.message : String(threw);
      const matches =
        !expected ||
        (expected instanceof RegExp
          ? expected.test(msg)
          : msg.includes(expected));
      check(
        did && matches,
        did
          ? `expected error ${fmt(msg)} to match ${fmt(expected)}`
          : "expected function to throw",
      );
    },
  };
  return m;
}

type Matchers = ReturnType<typeof createMatchers>;
type AsyncMatchers = {
  [K in keyof Matchers]: (...args: Parameters<Matchers[K]>) => Promise<void>;
} & {
  not: {
    [K in keyof Matchers]: (...args: Parameters<Matchers[K]>) => Promise<void>;
  };
};
type Expectation = Matchers & {
  not: Matchers;
  resolves: AsyncMatchers;
  rejects: AsyncMatchers;
};

/** Matchers that await a promise first: `await expect(p).resolves.toBe(1)`. */
function asyncMatchers(
  value: Promise<unknown>,
  negate: boolean,
): AsyncMatchers["not"] {
  const out = {} as AsyncMatchers["not"];
  for (const key of Object.keys(
    createMatchers(undefined, negate),
  ) as (keyof Matchers)[]) {
    out[key] = ((...args: unknown[]) =>
      value.then((v) =>
        (createMatchers(v, negate)[key] as (...a: unknown[]) => void)(...args),
      )) as never;
  }
  return out;
}

export function expect(actual: unknown): Expectation {
  const base = createMatchers(actual, false) as Expectation;
  base.not = createMatchers(actual, true);
  const resolved = () => Promise.resolve(actual);
  const rejected = () =>
    Promise.resolve(actual).then(
      () => {
        throw new AssertionError("expected promise to reject");
      },
      (e: unknown) => (e instanceof Error ? e.message : e),
    );
  Object.defineProperty(base, "resolves", {
    get: () =>
      Object.assign(asyncMatchers(resolved(), false), {
        not: asyncMatchers(resolved(), true),
      }),
  });
  Object.defineProperty(base, "rejects", {
    get: () =>
      Object.assign(asyncMatchers(rejected(), false), {
        not: asyncMatchers(rejected(), true),
      }),
  });
  return base;
}

/** Build one isolated registry per run so tests never leak between runs. */
export function createHarness() {
  const tests: Registered[] = [];
  const stack: string[] = [];
  // Hooks registered in the current describe scope apply to the tests inside it,
  // like vitest: outer beforeEach first, outer afterEach last.
  type Scope = { before: Fn[]; after: Fn[] };
  const scopes: Scope[] = [{ before: [], after: [] }];
  const current = () => scopes[scopes.length - 1]!;
  const describe = (name: string, fn: () => void) => {
    stack.push(name);
    scopes.push({ before: [], after: [] });
    try {
      fn();
    } finally {
      scopes.pop();
      stack.pop();
    }
  };
  const it = (name: string, fn: Fn) => {
    const before = scopes.flatMap((s) => s.before);
    const after = [...scopes].reverse().flatMap((s) => s.after);
    const wrapped: Fn = async () => {
      for (const b of before) await b();
      try {
        await fn();
      } finally {
        for (const a of after) await a();
      }
    };
    tests.push({ name: [...stack, name].join(" › "), fn: wrapped });
  };
  const noop = () => {};
  it.skip = noop as (name: string, fn?: Fn) => void;
  it.todo = noop as (name: string) => void;
  describe.skip = noop as (name: string, fn: () => void) => void;
  const beforeEach = (fn: Fn) => {
    current().before.push(fn);
  };
  const afterEach = (fn: Fn) => {
    current().after.push(fn);
  };

  async function run(perTestTimeoutMs = 2000): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const t of tests) {
      const started = Date.now();
      try {
        await Promise.race([
          Promise.resolve().then(t.fn),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`timed out after ${perTestTimeoutMs} ms`)),
              perTestTimeoutMs,
            ),
          ),
        ]);
        results.push({
          name: t.name,
          passed: true,
          durationMs: Date.now() - started,
        });
      } catch (e) {
        results.push({
          name: t.name,
          passed: false,
          error:
            e instanceof Error
              ? `${e.name === "AssertionError" ? "" : e.name + ": "}${e.message}`
              : String(e),
          durationMs: Date.now() - started,
        });
      }
    }
    return results;
  }

  /** What `import { … } from "vitest"` resolves to inside exercise code. */
  const api = {
    describe,
    it,
    test: it,
    expect,
    beforeEach,
    afterEach,
  };
  return { api, run, count: () => tests.length };
}
