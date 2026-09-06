import { Link, Text } from "react-email";
import { Action, Layout, LinkFallback, colours, styles } from "./layout";

export function VerifyEmail({ name, url }: { name: string; url: string }) {
  return (
    <Layout
      preview="Confirm your email to finish setting up devhelp"
      heading="Confirm your email"
    >
      <Text style={styles.text}>Hi {name || "there"},</Text>
      <Text style={styles.text}>
        Confirm this address so you can contribute reviews, questions, and
        projects on devhelp. Learning never needs it, contributing does.
      </Text>
      <Action href={url}>Confirm email</Action>
      <LinkFallback href={url} />
    </Layout>
  );
}

export function ResetPassword({ name, url }: { name: string; url: string }) {
  return (
    <Layout preview="Reset your devhelp password" heading="Reset your password">
      <Text style={styles.text}>Hi {name || "there"},</Text>
      <Text style={styles.text}>
        Someone asked to reset the password for this account. If that was you,
        choose a new one below. If not, ignore this email; nothing changes.
      </Text>
      <Action href={url}>Choose a new password</Action>
      <LinkFallback href={url} />
    </Layout>
  );
}

export function OrganizationInvitation({
  inviter,
  organization,
  url,
  expiresIn,
}: {
  inviter: string;
  organization: string;
  url: string;
  expiresIn: string;
}) {
  return (
    <Layout
      preview={`${inviter} invited you to ${organization} on devhelp`}
      heading={`Join ${organization}`}
    >
      <Text style={styles.text}>
        {inviter} invited you to join {organization} on devhelp. Members can be
        placed in cohorts and follow courses together.
      </Text>
      <Action href={url}>Accept invitation</Action>
      <Text style={styles.muted}>The invitation expires in {expiresIn}.</Text>
      <LinkFallback href={url} />
    </Layout>
  );
}

export function MentorApplicationDecided({
  name,
  approved,
  reason,
  policyUrl,
  url,
}: {
  name: string;
  approved: boolean;
  reason?: string;
  policyUrl?: string;
  url: string;
}) {
  return (
    <Layout
      preview={
        approved ? "You are a devhelp mentor" : "About your mentor application"
      }
      heading={approved ? "Welcome aboard, mentor" : "Your mentor application"}
    >
      <Text style={styles.text}>Hi {name || "there"},</Text>
      {approved ? (
        <Text style={styles.text}>
          Your application was approved. You can now review contributions in
          your tracks and propose content changes from the studio.
        </Text>
      ) : (
        <Text style={styles.text}>
          We are not taking your application forward right now.
          {reason ? ` The reviewer wrote: "${reason}"` : ""}
          {policyUrl ? " The relevant policy clause is linked below." : ""} You
          can apply again in 30 days.
        </Text>
      )}
      <Action href={url}>
        {approved ? "Open the moderation queue" : "See your application"}
      </Action>
      {policyUrl ? <LinkFallback href={policyUrl} /> : null}
    </Layout>
  );
}

export function ModerationDecided({
  name,
  subject,
  approved,
  reason,
  policyUrl,
  url,
}: {
  name: string;
  subject: string;
  approved: boolean;
  reason?: string;
  policyUrl?: string;
  url: string;
}) {
  return (
    <Layout
      preview={`${subject}: ${approved ? "published" : "not published"}`}
      heading={approved ? `${subject} is live` : `${subject} was not published`}
    >
      <Text style={styles.text}>Hi {name || "there"},</Text>
      <Text style={styles.text}>
        {approved
          ? "A moderator approved your submission and it is now visible."
          : `A moderator did not publish your submission.${reason ? ` Reason: "${reason}"` : ""}`}
      </Text>
      <Action href={url}>{approved ? "View it" : "Review and edit"}</Action>
      {policyUrl ? <LinkFallback href={policyUrl} /> : null}
    </Layout>
  );
}

export function CommentAccepted({
  name,
  subject,
  url,
}: {
  name: string;
  subject: string;
  url: string;
}) {
  return (
    <Layout
      preview="A mentor accepted your answer"
      heading="Your answer was accepted"
    >
      <Text style={styles.text}>Hi {name || "there"},</Text>
      <Text style={styles.text}>
        A mentor marked your reply on {subject} as the accepted answer. It now
        sits at the top of the thread for every learner who lands there.
      </Text>
      <Action href={url}>Open the thread</Action>
    </Layout>
  );
}

export function CertificateIssued({
  name,
  courseTitle,
  verifyUrl,
  pdfUrl,
}: {
  name: string;
  courseTitle: string;
  verifyUrl: string;
  pdfUrl: string;
}) {
  return (
    <Layout
      preview={`Your certificate for ${courseTitle}`}
      heading="You finished the course"
    >
      <Text style={styles.text}>Hi {name || "there"},</Text>
      <Text style={styles.text}>
        Your certificate for {courseTitle} is ready. The verify link shows
        exactly what you did; share it on LinkedIn or a CV. The PDF carries the
        same link and a QR code.
      </Text>
      <Action href={verifyUrl}>Open your certificate</Action>
      <Text style={styles.muted}>
        PDF:{" "}
        <Link href={pdfUrl} style={{ color: colours.indigo }}>
          {pdfUrl}
        </Link>
      </Text>
    </Layout>
  );
}

export function CertificateRevoked({
  name,
  courseTitle,
  reason,
  verifyUrl,
}: {
  name: string;
  courseTitle: string;
  reason: string;
  verifyUrl: string;
}) {
  return (
    <Layout
      preview={`Your certificate for ${courseTitle} was revoked`}
      heading="A certificate was revoked"
    >
      <Text style={styles.text}>Hi {name || "there"},</Text>
      <Text style={styles.text}>
        An administrator revoked your certificate for {courseTitle}. Reason:
        &ldquo;{reason}&rdquo;. The verify page now says so. If you think this
        is a mistake, reply to this email.
      </Text>
      <Action href={verifyUrl}>See the verify page</Action>
    </Layout>
  );
}
