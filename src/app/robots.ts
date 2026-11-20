import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * Crawlers that fetch every player and match page, each one a fresh render
 * that reads the database. Meta's AI crawler did that on 2026-11-20 and nearly
 * used up the month's Turso rows-read quota in a few hours. A firewall rule on
 * Vercel denies it too; robots.txt is the polite way to ask first.
 */
const BLOCKED_CRAWLERS = ["meta-externalagent"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: "/api/" },
    ],
    sitemap: new URL("/sitemap.xml", siteConfig.url).href,
  };
}
