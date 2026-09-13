import { Page } from "./site-header";
import { shellSession } from "./session";
import { ToolsShell } from "./tools-shell";

/**
 * One shell for every page but the lesson reader, chosen by who is looking.
 *
 * Signed in, you get the sidebar rail — on `/courses` and `/companies` as much
 * as on `/account`. The first cut put the rail only on the signed-in tools,
 * which meant the rail's own "Courses" link made the rail disappear: a
 * navigation item that removes the navigation.
 *
 * Signed out — which includes every crawler — you get `SiteHeader` and no rail.
 * That is what keeps F2.14 and the catalogue indexable: the anonymous render is
 * still a document with the full width S15 widened these pages to gain, and the
 * rail is chrome for people with an account rather than something a search
 * result has to carry.
 *
 * Both branches render the same `children`, so what a crawler indexes and what a
 * learner reads are the same content.
 */
export async function Shell({
  children,
  wide = false,
  callbackURL = "/home",
}: {
  children: React.ReactNode;
  /** Data-dense pages (`max-w-7xl`); reading pages stay narrow. */
  wide?: boolean;
  /** Where to return after signing in; defaults to the dashboard. */
  callbackURL?: string;
}) {
  const session = await shellSession();
  if (!session)
    return (
      <Page wide={wide} callbackURL={callbackURL}>
        {children}
      </Page>
    );
  return (
    <ToolsShell wide={wide} callbackURL={callbackURL}>
      {children}
    </ToolsShell>
  );
}
