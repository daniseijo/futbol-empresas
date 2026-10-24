"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { siteConfig } from "@/config/site";

const LINKS = [
  {
    href: "/",
    label: "Inicio",
    match: (path: string) => path === "/",
    icon: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  },
  {
    href: `/equipos/${siteConfig.focusTeamSlug}`,
    label: "Mi equipo",
    match: (path: string) => path.startsWith(`/equipos/${siteConfig.focusTeamSlug}`),
    icon: <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />,
  },
];

/**
 * The main menu: inline in the header from `sm` up, and a tab bar fixed to the
 * bottom of the screen on phones, within thumb reach (and clear of the home
 * indicator when the site is installed as an app).
 *
 * On routes with params not generated at build time, the URL is unknown while
 * prerendering and usePathname() suspends: meanwhile the same links render
 * without the active one marked, so the menu stays in the static shell. That
 * shell is shared by every route and is not re-rendered on a full page load
 * (opening the installed app, a reload), so once hydrated the fallback marks
 * the active link from the browser's URL.
 */
export function MainNav() {
  return (
    <Suspense fallback={<ShellNav />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

const noSubscription = () => () => {};

function ShellNav() {
  const pathname = useSyncExternalStore(
    noSubscription,
    () => window.location.pathname,
    () => null,
  );
  return <NavLinks pathname={pathname} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  const isActive = (link: (typeof LINKS)[number]) => pathname !== null && link.match(pathname);
  return (
    <>
      <nav aria-label="Principal" className="hidden gap-0.5 sm:flex sm:flex-1">
        {LINKS.map((link) => {
          const active = isActive(link);
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
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {LINKS.map((link) => {
          const active = isActive(link);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-15 flex-1 flex-col items-center justify-center gap-1 text-[11px] ${
                active ? "font-semibold text-accent-text" : "font-medium text-muted"
              }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={active ? "currentColor" : "none"}
                fillOpacity={active ? 0.15 : undefined}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {link.icon}
              </svg>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
