import { env } from "@repo/env";
import { Resend } from "resend";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
};

export type Transport = {
  name: "resend" | "smtp" | "log";
  send(mail: OutgoingEmail): Promise<{ id: string }>;
};

/** Everything the `log` transport sent, newest last. Tests read it; `resetOutbox()` between cases. */
export const outbox: OutgoingEmail[] = [];
export function resetOutbox() {
  outbox.length = 0;
}

function logTransport(): Transport {
  return {
    name: "log",
    async send(mail) {
      outbox.push(mail);
      if (env.NODE_ENV !== "test") {
        console.info(
          `[email] to ${mail.to}: ${mail.subject}\n${mail.text.trim()}\n`,
        );
      }
      return { id: `log-${outbox.length}` };
    },
  };
}

/**
 * Exported for the Mailpit round-trip test; app code uses `getTransport()`.
 *
 * `nodemailer` is imported on first send, not at module load. SMTP is the
 * local-development transport (Mailpit); production sends through Resend, and a
 * top-level import put nodemailer and its `net`/`tls`/`dns` dependencies into
 * the production Worker bundle for a code path that never runs there (S22).
 */
export function smtpTransport(url: string): Transport {
  let mailer: import("nodemailer").Transporter | undefined;
  return {
    name: "smtp",
    async send(mail) {
      mailer ??= (await import("nodemailer")).default.createTransport(url);
      const info = await mailer.sendMail({
        from: mail.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      return { id: info.messageId };
    },
  };
}

function resendTransport(apiKey: string): Transport {
  const resend = new Resend(apiKey);
  return {
    name: "resend",
    async send(mail) {
      const { data, error } = await resend.emails.send({
        from: mail.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (error || !data)
        throw new Error(`Resend: ${error?.message ?? "no id"}`);
      return { id: data.id };
    },
  };
}

let cached: Transport | null = null;
/** The transport `EMAIL_PROVIDER` names; validated by `@repo/env` (`checkPairs`). */
export function getTransport(): Transport {
  if (cached) return cached;
  // Checked here rather than at env validation so builds (NODE_ENV=production) need no mail credentials.
  if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER === "log")
    throw new Error("EMAIL_PROVIDER must be resend or smtp in production");
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      cached = resendTransport(env.RESEND_API_KEY ?? "");
      break;
    case "smtp":
      cached = smtpTransport(env.SMTP_URL ?? "");
      break;
    default:
      cached = logTransport();
  }
  return cached;
}
