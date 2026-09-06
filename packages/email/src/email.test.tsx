import { afterEach, describe, expect, it } from "vitest";
import {
  MentorApplicationDecided,
  OrganizationInvitation,
  ResetPassword,
  VerifyEmail,
  outbox,
  resetOutbox,
  sendEmail,
} from "./index";

afterEach(() => resetOutbox());

describe("sendEmail", () => {
  it("renders a template to html and text and records it in the log outbox", async () => {
    const r = await sendEmail({
      to: "ayesha@example.com",
      subject: "Confirm your email",
      react: (
        <VerifyEmail
          name="Ayesha"
          url="https://learn.devhelp.pk/verify?token=abc"
        />
      ),
    });
    expect(r.transport).toBe("log");
    expect(outbox).toHaveLength(1);
    const mail = outbox[0]!;
    expect(mail.to).toBe("ayesha@example.com");
    expect(mail.from).toContain("@");
    expect(mail.html).toContain("Confirm email");
    expect(mail.html).toContain("https://learn.devhelp.pk/verify?token=abc");
    expect(mail.text).toContain("https://learn.devhelp.pk/verify?token=abc");
    expect(mail.text).not.toContain("<");
  });

  it("every template renders with its key content", async () => {
    await sendEmail({
      to: "a@b.c",
      subject: "r",
      react: <ResetPassword name="A" url="https://x/reset" />,
    });
    await sendEmail({
      to: "a@b.c",
      subject: "i",
      react: (
        <OrganizationInvitation
          inviter="Bilal"
          organization="NUST ACM"
          url="https://x/accept/1"
          expiresIn="48 hours"
        />
      ),
    });
    await sendEmail({
      to: "a@b.c",
      subject: "m",
      react: (
        <MentorApplicationDecided
          name="A"
          approved={false}
          reason="Not yet"
          policyUrl="https://x/policy#c1"
          url="https://x/apply"
        />
      ),
    });
    expect(outbox.map((m) => m.text)).toEqual([
      expect.stringContaining("https://x/reset"),
      expect.stringContaining("NUST ACM"),
      expect.stringContaining("Not yet"),
    ]);
  });
});
