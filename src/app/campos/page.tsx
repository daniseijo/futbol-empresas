import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getVenuesIndex } from "@/lib/views/venue";

export const metadata: Metadata = { title: "Campos" };

export default function VenuesPage() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-7 sm:px-6">
      <h1 className="font-display text-[40px] leading-none font-extrabold uppercase sm:text-[52px]">Campos</h1>
      <Suspense fallback={<div className="h-[640px] animate-pulse rounded-[22px] bg-line-soft" aria-busy="true" />}>
        <VenueList />
      </Suspense>
    </main>
  );
}

async function VenueList() {
  const { season, venues } = await getVenuesIndex();
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
      {venues.map(({ venue, matches }) => (
        <li key={venue.id}>
          <Link
            href={`/campos/${venue.id}`}
            className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface px-4 py-3.5 hover:border-ink"
          >
            <span className="font-semibold">{venue.name}</span>
            <span className="text-sm text-muted">{venue.address ?? "Dirección por confirmar"}</span>
            <span className={`mt-auto pt-1.5 text-xs font-semibold ${matches === 0 ? "text-muted" : "text-accent-text"}`}>
              {matches === 0 ? `Sin partidos en ${season}` : `${matches} ${matches === 1 ? "partido" : "partidos"} en ${season}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
