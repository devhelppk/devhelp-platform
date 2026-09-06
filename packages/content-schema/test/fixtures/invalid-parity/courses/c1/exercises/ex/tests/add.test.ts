import { expect, it, vi } from "vitest";
import { add } from "../starter/add";
it("adds", () => {
  const spy = vi.fn();
  spy();
  expect(add(1, 2)).toBe(3);
});
