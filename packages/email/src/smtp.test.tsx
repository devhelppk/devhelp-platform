import { describe, expect, it } from "vitest";
import { smtpTransport } from "./transport";

const smtpUrl = process.env.SMTP_URL;
const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";

/**
 * Real SMTP round trip through Mailpit (docker-compose locally, a service in
 * CI). Skipped when SMTP_URL is unset so a bare `pnpm test` still passes.
 */
describe.skipIf(!smtpUrl)("smtp transport", () => {
  it("delivers to Mailpit with html and text parts", async () => {
    const to = `smtp-${crypto.randomUUID().slice(0, 8)}@devhelp.test`;
    const subject = `Mailpit round trip ${Date.now()}`;
    const { id } = await smtpTransport(smtpUrl!).send({
      to,
      from: "devhelp <no-reply@devhelp.pk>",
      subject,
      html: "<p>Hello <strong>there</strong></p>",
      text: "Hello there",
    });
    expect(id).toBeTruthy();
    let found: { ID: string } | undefined;
    for (let i = 0; i < 20 && !found; i++) {
      const r = await fetch(
        `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const { messages } = (await r.json()) as {
        messages: { ID: string; Subject: string }[];
      };
      found = messages.find((m) => m.Subject === subject);
      if (!found) await new Promise((r) => setTimeout(r, 250));
    }
    expect(found).toBeTruthy();
    const msg = (await (
      await fetch(`${mailpit}/api/v1/message/${found!.ID}`)
    ).json()) as { Text: string; HTML: string };
    expect(msg.Text).toContain("Hello there");
    expect(msg.HTML).toContain("<strong>there</strong>");
  });
});
