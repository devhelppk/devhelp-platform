import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt =
  "devhelp — the missing semester between your degree and your first engineering job";

/** The card every shared devhelp.pk link shows. */
export default function Image() {
  return ogCard({
    eyebrow: "Free · open source · Pakistan",
    title: "The missing semester between your degree and your first job",
    detail: "Learn by fixing code that is already broken.",
  });
}
