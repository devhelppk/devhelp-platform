import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Literata } from "next/font/google";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { DeferredToaster } from "@/components/shell/deferred-toaster";

const literata = Literata({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "devhelp Learn", template: "%s · devhelp" },
  description:
    "The devhelp learning platform: courses, lessons, and progress tracking.",
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
