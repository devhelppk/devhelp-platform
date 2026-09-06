import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * The Markdown subset learners may write (F4.3), rendered on the server at
 * write time and sanitised with an allow-list. Nothing from the client is
 * trusted: raw HTML is dropped, links are nofollow + ugc and open in a new tab.
 */
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "del",
    "code",
    "pre",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h2",
    "h3",
    "h4",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    code: ["class"],
    pre: ["class", "data-language"],
    th: ["align"],
    td: ["align"],
  },
  allowedClasses: { code: ["language-*"], pre: ["language-*"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "nofollow ugc noopener",
      target: "_blank",
    }),
  },
  disallowedTagsMode: "discard",
};

marked.setOptions({ gfm: true, breaks: false });

/** Renders Markdown to sanitised HTML. Cheap enough to run on every write and preview. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return sanitizeHtml(html, options).trim();
}

/** True when the text carries a link (used for the new-account hold, F4.5). */
export function hasLink(markdown: string): boolean {
  return /https?:\/\/|www\.|\[[^\]]+\]\([^)]+\)/i.test(markdown);
}
