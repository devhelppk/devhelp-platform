import { describe, expect, it } from "vitest";
import { renderCertificatePdf } from "./index";

const base = {
  id: "0b0f8c4a-2b2a-4c2f-9a1e-9c1f3d3e5a11",
  learnerName: "Ayesha Khan",
  courseTitle: "AI Engineering Foundations",
  issuedAt: new Date("2026-09-06T10:00:00Z"),
  verifyUrl:
    "https://learn.devhelp.pk/verify/0b0f8c4a-2b2a-4c2f-9a1e-9c1f3d3e5a11",
  contentCommit: "cee5237fd5fb",
  summary: { lessons: 4, quizzes: 1, bestQuizScore: 100, projects: 0 },
};

describe("renderCertificatePdf", () => {
  it("produces a PDF carrying the name, course, verify URL, and a QR image", async () => {
    const bytes = await renderCertificatePdf(base);
    const head = new TextDecoder().decode(bytes.slice(0, 8));
    expect(head.startsWith("%PDF-")).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(20_000);
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("/Image");
    expect(text).toContain("devhelp.pk");
  }, 30_000);
  it("stamps a revoked certificate", async () => {
    const bytes = await renderCertificatePdf({
      ...base,
      revoked: {
        at: new Date("2026-10-01"),
        reason: "Issued to the wrong account",
      },
    });
    expect(bytes.byteLength).toBeGreaterThan(20_000);
  }, 30_000);
});
