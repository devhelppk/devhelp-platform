import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Literata } from "next/font/google";
import { clientEnv } from "@repo/env/client";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { Toaster } from "@repo/ui/components/sonner";
import { TooltipProvider } from "@repo/ui/components/tooltip";

// Literata was drawn for reading on Android screens (Google Play Books);
// it carries headings and lesson prose. Geist carries the interface.
const literata = Literata({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  // Without a base, Next cannot make an absolute URL for an Open Graph image
  // or a canonical link, and every share card falls back to nothing. The value
  // comes from the validated env, which defaults to localhost outside
  // production, so a preview build does not advertise the real domain.
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_WEB_URL),
  title: {
    default:
      "devhelp — free, open-source learning for Pakistan's software engineers",
    template: "%s · devhelp",
  },
  description:
    "Free, open-source courses and guidance for students and engineers in Pakistan: technical skills, career skills, and AI-era engineering.",
  openGraph: {
    type: "website",
    siteName: "devhelp",
    locale: "en_PK",
  },
  twitter: { card: "summary_large_image" },
};

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
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
