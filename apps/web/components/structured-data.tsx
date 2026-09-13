import { clientEnv } from "@repo/env/client";

/**
 * `Organization` and `WebSite` for the marketing root.
 *
 * Plain JSON in a script tag, no library: this is two objects that change when
 * the brand changes, which is approximately never. `JSON.stringify` output is
 * safe inside `application/ld+json` because none of these values come from a
 * user — they are constants and one validated env var.
 */
export function SiteStructuredData() {
  const web = clientEnv.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
  const lms = clientEnv.NEXT_PUBLIC_LMS_URL.replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${web}/#organization`,
        name: "devhelp",
        alternateName: "devhelp.pk",
        url: web,
        description:
          "A free, open-source learning platform for software engineers and students in Pakistan.",
        email: "policy@devhelp.pk",
        foundingLocation: { "@type": "Country", name: "Pakistan" },
        sameAs: [
          "https://github.com/devhelppk",
          "https://github.com/devhelppk/devhelp-platform",
          "https://github.com/devhelppk/devhelp-content",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${web}/#website`,
        url: web,
        name: "devhelp",
        publisher: { "@id": `${web}/#organization` },
        inLanguage: "en",
      },
      {
        // The courses live on the learning platform, which is a separate host;
        // saying so is what lets a search engine treat them as one project.
        "@type": "EducationalOrganization",
        "@id": `${lms}/#school`,
        name: "devhelp Learn",
        url: `${lms}/courses`,
        parentOrganization: { "@id": `${web}/#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
