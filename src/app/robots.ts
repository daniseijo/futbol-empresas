import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * AI crawlers fetch every player and match page, each one a fresh render that
 * reads the database. Meta's did that on 2026-11-20 and nearly used up the
 * month's Turso rows-read quota in a few hours. Vercel's firewall denies them
 * (the managed "AI Bots" rule); robots.txt is the polite way to ask first.
 * Search engines and link previews (Googlebot, facebookexternalhit, Slackbot)
 * stay allowed.
 */
const BLOCKED_CRAWLERS = [
  "meta-externalagent",
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Bytespider",
  "PerplexityBot",
  "Amazonbot",
  "Applebot-Extended",
  "Google-Extended",
  "cohere-ai",
  "Diffbot",
  "omgili",
  "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: "/api/" },
    ],
    sitemap: new URL("/sitemap.xml", siteConfig.url).href,
  };
}
