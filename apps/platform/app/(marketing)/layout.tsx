import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

/**
 * The public pages: the landing, about, contribute, FAQ, the Markdown documents
 * and `/design`. Each page owns its `<main>`.
 *
 * The header is `static` — it never reads the session — because the Markdown
 * documents are `force-static` (S23 D5) and a `headers()` call here would make
 * every one of them dynamic. The landing reads the session itself, to send a
 * signed-in visitor to `/home`.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader static />
      {children}
      <SiteFooter />
    </div>
  );
}
