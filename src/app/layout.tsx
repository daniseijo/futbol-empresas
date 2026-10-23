import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  // Installed on an iPhone's home screen, it opens without Safari's bars.
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // The header's colour, so the browser and the installed app blend into it.
  themeColor: "#ffffff",
  // Lets the page reach under the home indicator; the bottom tab bar pads itself with safe-area-inset-bottom.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${barlow.variable} h-full antialiased`}>
      {/* Extensions such as Grammarly add attributes to <body> before hydration. */}
      {/* On phones the bottom padding leaves room for MainNav's tab bar. */}
      <body className="flex min-h-full flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] sm:pb-0" suppressHydrationWarning>
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        {/* Visits and real-user performance on Vercel; outside Vercel they send nothing. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
