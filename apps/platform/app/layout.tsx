import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Literata } from "next/font/google";
import { clientEnv } from "@repo/env/client";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { DeferredToaster } from "@/components/shell/deferred-toaster";

const literata = Literata({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  // Company pages are the platform's main SEO entry point (F2.14) and are
  // shared as links; without a base their Open Graph images have no absolute
  // URL and every card comes out blank.
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default:
      "devhelp — free, open-source learning for Pakistan's software engineers",
    template: "%s · devhelp",
  },
  description:
    "Free, open-source courses and guidance for students and engineers in Pakistan: technical skills, career skills, and AI-era engineering.",
  openGraph: { type: "website", siteName: "devhelp", locale: "en_PK" },
  twitter: { card: "summary_large_image" },
};

/**
 * Kept deliberately thin: every provider here ships to every page. The tRPC
 * provider wraps only the pages with progress islands (see `LearnerProviders`).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${literata.variable}`}
    >
      <body className="min-h-dvh font-sans antialiased">
        <ThemeProvider>
          {children}
          <DeferredToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
