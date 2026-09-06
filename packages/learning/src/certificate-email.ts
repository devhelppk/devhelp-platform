import { env } from "@repo/env";
import { createElement } from "react";

/** Builds the `email` argument for notify() from the @repo/email templates, loaded on demand. */
export async function sendEmailTemplate(
  kind: "issued" | "revoked",
  input: {
    to: string;
    name: string;
    courseTitle: string;
    certificateId: string;
    reason?: string;
  },
) {
  const { CertificateIssued, CertificateRevoked } = await import("@repo/email");
  const verifyUrl = `${env.NEXT_PUBLIC_LMS_URL}/verify/${input.certificateId}`;
  const pdfUrl = `${env.NEXT_PUBLIC_LMS_URL}/api/certificates/${input.certificateId}.pdf`;
  return kind === "issued"
    ? {
        to: input.to,
        subject: `Your certificate for ${input.courseTitle}`,
        react: createElement(CertificateIssued, {
          name: input.name,
          courseTitle: input.courseTitle,
          verifyUrl,
          pdfUrl,
        }),
      }
    : {
        to: input.to,
        subject: `Your certificate for ${input.courseTitle} was revoked`,
        react: createElement(CertificateRevoked, {
          name: input.name,
          courseTitle: input.courseTitle,
          reason: input.reason ?? "",
          verifyUrl,
        }),
      };
}
