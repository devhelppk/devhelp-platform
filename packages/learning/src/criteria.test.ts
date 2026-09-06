import { describe, expect, it } from "vitest";
import { evaluateCompletion } from "./criteria";

describe("evaluateCompletion", () => {
  it("defaults to requiring all required lessons", () => {
    expect(
      evaluateCompletion(undefined, { requiredTotal: 2, requiredDone: 2 })
        .complete,
    ).toBe(true);
    expect(
      evaluateCompletion({}, { requiredTotal: 2, requiredDone: 1 }),
    ).toEqual({
      complete: false,
      unmet: ["requireAllRequiredLessons"],
    });
  });

  it("never completes a course with zero required lessons", () => {
    expect(
      evaluateCompletion({}, { requiredTotal: 0, requiredDone: 0 }).complete,
    ).toBe(false);
  });

  it("reports quiz and project criteria as unmet until S4/S8 supply facts", () => {
    const v = evaluateCompletion(
      { minQuizScore: 70, requireProjectAccepted: true },
      { requiredTotal: 1, requiredDone: 1 },
    );
    expect(v).toEqual({
      complete: false,
      unmet: ["minQuizScore", "requireProjectAccepted"],
    });
    expect(
      evaluateCompletion(
        { minQuizScore: 70, requireProjectAccepted: true },
        {
          requiredTotal: 1,
          requiredDone: 1,
          quizScoreAvg: 80,
          projectsAccepted: true,
        },
      ).complete,
    ).toBe(true);
  });

  it("rejects unknown criteria keys", () => {
    expect(() =>
      evaluateCompletion({ bogus: true } as never, {
        requiredTotal: 1,
        requiredDone: 1,
      }),
    ).toThrow();
  });
});
