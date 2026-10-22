"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "Resumen" },
  { segment: "partidos", label: "Partidos" },
  { segment: "clasificacion", label: "Clasificación" },
  { segment: "plantilla", label: "Plantilla" },
  { segment: "historial", label: "Historial" },
];

/** Pestañas de un equipo: cada una es una ruta propia bajo /equipos/[slug]. */
export function TeamTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/equipos/${slug}`;
  return (
    <nav aria-label="Secciones del equipo" className="relative mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = pathname === href;
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`border-b-3 px-4 py-3.5 text-[15px] whitespace-nowrap ${
              active ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-muted hover:border-line hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
