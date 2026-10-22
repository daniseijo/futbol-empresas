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
 * En rutas con parámetros que no se generan en el build, la URL no se conoce al
 * prerenderizar y usePathname() suspende: mientras tanto se pintan los mismos
 * enlaces sin marcar el activo, así el menú sigue en la parte estática.
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
