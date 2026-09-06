import { renderCertificatePdf } from "@repo/certificates";
import { db, eq, schema } from "@repo/database";
import { clientEnv } from "@repo/env/client";
import { getStorage } from "@repo/storage";
import { NextResponse } from "next/server";

/**
 * GET /api/certificates/<uuid>.pdf: renders on first request, caches the
 * bytes in object storage, and streams them. Anyone with the uuid may
 * download (the verify page is public). Revocation clears the cache so the
 * next download carries the stamp.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  const id = file.replace(/\.pdf$/, "");
  if (!/^[0-9a-f-]{36}$/.test(id))
    return new NextResponse("Not found", { status: 404 });
  const cert = await db.query.certificates.findFirst({
    where: eq(schema.certificates.id, id),
    with: { contentRevision: { columns: { commitSha: true } } },
  });
  if (!cert) return new NextResponse("Not found", { status: 404 });
  const storage = getStorage();
  const key =
    cert.pdfKey ??
    `certificates/${cert.id}/${cert.revokedAt ? "revoked-" + cert.revokedAt.getTime() : "issued"}.pdf`;
  let cached = cert.pdfKey ? await storage.get(cert.pdfKey) : null;
  if (!cached) {
    const quizzes = cert.criteria.quizzes;
    const bytes = await renderCertificatePdf({
      id: cert.id,
      learnerName: cert.learnerName,
      courseTitle: cert.courseTitle,
      issuedAt: cert.issuedAt,
      verifyUrl: `${clientEnv.NEXT_PUBLIC_LMS_URL}/verify/${cert.id}`,
      contentCommit:
        cert.contentRevision?.commitSha ?? cert.criteria.contentCommit,
      summary: {
        lessons: cert.criteria.lessons.length,
        quizzes: quizzes.length,
        bestQuizScore: quizzes.length
          ? Math.max(...quizzes.map((q) => q.bestScore))
          : undefined,
        projects: cert.criteria.projects.length,
      },
      revoked: cert.revokedAt
        ? { at: cert.revokedAt, reason: cert.revokedReason ?? "" }
        : null,
    });
    await storage.put(key, bytes, "application/pdf");
    await db
      .update(schema.certificates)
      .set({ pdfKey: key })
      .where(eq(schema.certificates.id, cert.id));
    cached = { bytes, contentType: "application/pdf" };
  }
  const safeName = `${cert.courseTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-certificate.pdf`;
  return new NextResponse(Buffer.from(cached.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
