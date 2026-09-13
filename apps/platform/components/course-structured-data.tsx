import { clientEnv } from "@repo/env/client";

/**
 * `Course` structured data, so a search result for a course can carry its name,
 * its provider and the fact that it is free.
 *
 * `offers` is the part worth having: it is the machine-readable version of the
 * promise on the marketing site, and a free course said so explicitly is
 * treated differently from one that stays silent about price.
 */
export function CourseStructuredData({
  slug,
  title,
  description,
  level,
}: {
  slug: string;
  title: string;
  description: string;
  level: string;
}) {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: title,
    description,
    url: `${site}/courses/${slug}`,
    inLanguage: "en",
    educationalLevel: level,
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      name: "devhelp",
      url: site,
    },
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "PKR",
      category: "Free",
      availability: "https://schema.org/InStock",
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: "PT1H",
    },
  };
  return (
    <script
      type="application/ld+json"
      // Title and description come from the studio, which only mentors and
      // admins can write to, and `JSON.stringify` escapes what it must.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
