import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("schema", () => {
  it("exposes the core LMS tables", () => {
    expect(getTableName(schema.users)).toBe("users");
    expect(getTableName(schema.courses)).toBe("courses");
    expect(getTableName(schema.lessons)).toBe("lessons");
    expect(getTableName(schema.enrollments)).toBe("enrollments");
  });
});
