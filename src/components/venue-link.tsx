import Link from "next/link";
import type { Venue } from "@/lib/sportspress/types";

/** A venue's name linking to its page. */
export function VenueLink({ venue, className = "" }: { venue: Venue; className?: string }) {
  return (
    <Link href={`/campos/${venue.id}`} className={`hover:text-accent-text hover:underline ${className}`}>
      {venue.name}
    </Link>
  );
}
