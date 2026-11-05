import type { Metadata, Viewport } from "next";
import { Figtree, Outfit } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";
// One stylesheet per area of the app, so each can change without touching the others.
import "@/styles/board.css";
import "@/styles/pages.css";
import "@/styles/account.css";
import "@/styles/admin.css";
import "@/styles/map.css";

const heading = Outfit({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-outfit" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: { default: "Best in the City · Ranked by bids", template: "%s · Best in the City" },
  description: "One board for every city and category. Local businesses ranked in public by the total amount bid.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF9F7" },
    { media: "(prefers-color-scheme: dark)", color: "#141110" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme on <html> before React loads, so the attribute may differ from the server's.
    <html lang="en" className={`${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
