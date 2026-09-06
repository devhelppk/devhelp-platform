import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

/**
 * One layout for every email: brand wordmark, a serif heading, short prose,
 * one button-style link, and a quiet footer. Colours are the design tokens'
 * hex values because email clients ignore CSS variables.
 */
export const colours = {
  ink: "#151824",
  paper: "#fbfaf7",
  muted: "#6b6f7e",
  indigo: "#3b3f8c",
  border: "#e5e3dc",
} as const;

export const styles = {
  body: {
    backgroundColor: colours.paper,
    color: colours.ink,
    fontFamily:
      "Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    margin: 0,
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    border: `1px solid ${colours.border}`,
    borderRadius: 8,
    maxWidth: 520,
    padding: "32px 36px",
  },
  brand: { fontSize: 15, fontWeight: 600, margin: "0 0 24px" },
  heading: {
    fontFamily: "Literata, Georgia, serif",
    fontSize: 24,
    fontWeight: 600,
    lineHeight: "32px",
    margin: "0 0 16px",
  },
  text: { fontSize: 15, lineHeight: "24px", margin: "0 0 16px" },
  button: {
    backgroundColor: colours.indigo,
    borderRadius: 6,
    color: "#ffffff",
    display: "inline-block",
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 18px",
    textDecoration: "none",
  },
  muted: { color: colours.muted, fontSize: 13, lineHeight: "20px", margin: 0 },
  hr: { borderColor: colours.border, margin: "24px 0" },
} as const;

export function Layout({
  preview,
  heading,
  children,
  footer,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>
            devhelp
            <span style={{ color: colours.muted, fontWeight: 400 }}>.pk</span>
          </Text>
          <Heading as="h1" style={styles.heading}>
            {heading}
          </Heading>
          {children}
          <Hr style={styles.hr} />
          <Section>
            {footer ?? (
              <Text style={styles.muted}>
                devhelp.pk is a free, open learning platform for software
                engineers in Pakistan. You received this because of an action on
                your account. Questions:{" "}
                <Link
                  href="mailto:hello@devhelp.pk"
                  style={{ color: colours.indigo }}
                >
                  hello@devhelp.pk
                </Link>
                .
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Action({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ margin: "8px 0 20px" }}>
      <Link href={href} style={styles.button}>
        {children}
      </Link>
    </Section>
  );
}

export function LinkFallback({ href }: { href: string }) {
  return (
    <Text style={styles.muted}>
      If the button does not work, open this link:{" "}
      <Link href={href} style={{ color: colours.indigo }}>
        {href}
      </Link>
    </Text>
  );
}
