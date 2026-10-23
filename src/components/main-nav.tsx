"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";

const LINKS = [
  { href: "/", label: "Inicio", match: (path: string) => path === "/" },
  {
    href: `/equipos/${siteConfig.focusTeamSlug}`,
    label: "Mi equipo",
    match: (path: string) => path.startsWith(`/equipos/${siteConfig.focusTeamSlug}`),
  },
];

/**
 * On routes with params not generated at build time, the URL is unknown while
 * prerendering and usePathname() suspends: meanwhile the same links render
 * without the active one marked, so the menu stays in the static shell.
 */
export function MainNav() {
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Principal" className="order-last flex w-full gap-0.5 sm:order-none sm:w-auto sm:flex-1">
      {LINKS.map((link) => {
        const active = pathname !== null && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm ${
              active ? "bg-accent-soft font-semibold text-accent-text" : "font-medium hover:bg-line-soft"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
