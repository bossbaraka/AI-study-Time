import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from "next/font/google";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/config/site";
import "./globals.css";

/**
 * Type: IBM Plex Sans Arabic (body — institutional, bilingual) +
 * Noto Kufi Arabic (display — echoes the heavy Kufi brand wordmark).
 * Self-hosted at build via next/font; no runtime CDN.
 */
const body = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const display = Noto_Kufi_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#071625" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${body.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
