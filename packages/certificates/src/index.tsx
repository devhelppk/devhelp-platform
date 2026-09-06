import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { toDataURL } from "qrcode";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type CertificateInput = {
  id: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  verifyUrl: string;
  contentCommit?: string;
  summary: {
    lessons: number;
    quizzes: number;
    bestQuizScore?: number;
    projects: number;
  };
  revoked?: { at: Date; reason: string } | null;
};

const fonts = join(dirname(fileURLToPath(import.meta.url)), "..", "fonts");
let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({ family: "Literata", src: join(fonts, "Literata.ttf") });
  Font.register({
    family: "Geist",
    fonts: [
      { src: join(fonts, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: join(fonts, "Geist-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

// Design tokens as hex: PDF has no CSS variables.
const ink = "#151824",
  paper = "#fbfaf7",
  indigo = "#3b3f8c",
  muted = "#6b6f7e",
  border = "#e5e3dc",
  madder = "#a63d40";

const s = StyleSheet.create({
  page: {
    backgroundColor: paper,
    color: ink,
    fontFamily: "Geist",
    padding: 48,
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderColor: border,
    padding: 40,
    position: "relative",
  },
  rule: { height: 4, width: 72, backgroundColor: indigo, marginBottom: 24 },
  brand: { fontSize: 13, fontWeight: 600, marginBottom: 28 },
  brandMuted: { color: muted, fontWeight: 400 },
  eyebrow: { fontSize: 11, color: muted, marginBottom: 6 },
  name: { fontFamily: "Literata", fontSize: 34, marginBottom: 18 },
  course: { fontFamily: "Literata", fontSize: 20, marginBottom: 20 },
  body: { fontSize: 11, lineHeight: 1.5, color: ink, maxWidth: 440 },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  small: { fontSize: 9, color: muted, lineHeight: 1.5 },
  qr: { width: 84, height: 84 },
  stamp: {
    position: "absolute",
    top: 36,
    right: 36,
    borderWidth: 2,
    borderColor: madder,
    color: madder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: 600,
    transform: "rotate(-8deg)",
  },
});

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CertificateDocument({
  c,
  qr,
}: {
  c: CertificateInput;
  qr: string;
}) {
  const { lessons, quizzes, bestQuizScore, projects } = c.summary;
  const parts = [`${lessons} required lesson${lessons === 1 ? "" : "s"}`];
  if (quizzes)
    parts.push(
      `${quizzes} quiz${quizzes === 1 ? "" : "zes"}${bestQuizScore !== undefined ? ` (best score ${bestQuizScore}%)` : ""}`,
    );
  if (projects)
    parts.push(`${projects} accepted project${projects === 1 ? "" : "s"}`);
  return (
    <Document
      title={`${c.courseTitle} certificate for ${c.learnerName}`}
      author="devhelp.pk"
      subject="Certificate of completion"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          {c.revoked ? (
            <Text style={s.stamp}>REVOKED {fmt(c.revoked.at)}</Text>
          ) : null}
          <View style={s.rule} />
          <Text style={s.brand}>
            devhelp<Text style={s.brandMuted}>.pk</Text>
          </Text>
          <Text style={s.eyebrow}>Certificate of completion</Text>
          <Text style={s.name}>{c.learnerName}</Text>
          <Text style={s.eyebrow}>completed</Text>
          <Text style={s.course}>{c.courseTitle}</Text>
          <Text style={s.body}>
            on {fmt(c.issuedAt)}, having finished {parts.join(", ")}.
            {c.revoked
              ? ` This certificate was revoked on ${fmt(c.revoked.at)}: ${c.revoked.reason}`
              : ""}
          </Text>
          <View style={s.footer}>
            <View>
              <Text style={s.small}>
                Verify this certificate and see exactly what was done:
              </Text>
              <Text style={[s.small, { color: indigo }]}>{c.verifyUrl}</Text>
              <Text style={s.small}>
                Certificate {c.id}
                {c.contentCommit
                  ? ` · content ${c.contentCommit.slice(0, 7)}`
                  : ""}
              </Text>
              <Text style={[s.small, { marginTop: 6 }]}>
                devhelp.pk is a free, open learning platform for software
                engineers in Pakistan.
              </Text>
            </View>
            <Image src={qr} style={s.qr} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Renders the certificate to PDF bytes. Pure JS: no browser, no network (fonts are vendored). */
export async function renderCertificatePdf(
  c: CertificateInput,
): Promise<Uint8Array> {
  registerFonts();
  const qr = await toDataURL(c.verifyUrl, {
    margin: 0,
    width: 256,
    color: { dark: ink, light: paper },
  });
  const buf = await renderToBuffer(<CertificateDocument c={c} qr={qr} />);
  return new Uint8Array(buf);
}
