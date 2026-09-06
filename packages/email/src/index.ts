import { render } from "@react-email/render";
import { env } from "@repo/env";
import type { ReactElement } from "react";
import { getTransport, type OutgoingEmail } from "./transport";

export { outbox, resetOutbox } from "./transport";
export type { OutgoingEmail } from "./transport";
export * from "./templates/index";

/**
 * Render a React Email template to HTML and plain text and hand it to the
 * configured transport. The only way email leaves the platform.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<{ id: string; transport: string }> {
  const [html, text] = await Promise.all([
    render(input.react),
    render(input.react, { plainText: true }),
  ]);
  const mail: OutgoingEmail = {
    to: input.to,
    subject: input.subject,
    html,
    text,
    from: env.EMAIL_FROM,
  };
  const transport = getTransport();
  const { id } = await transport.send(mail);
  return { id, transport: transport.name };
}
