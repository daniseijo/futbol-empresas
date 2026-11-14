import Image from "next/image";
import { crestSrc } from "@/lib/uploads";

export function initials(name: string): string {
  return name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * A team's crest. Without one, shows its initials in the same shape. Crests load eagerly: they are a few KB
 * each and arrive with streamed content, where lazy loading only delays them further. `priority` raises the
 * fetch priority of the ones at the top of the page.
 */
export function Crest({
  src,
  name,
  size = 32,
  className = "",
  priority = false,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const radius = Math.round(size * 0.24);
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center border border-line bg-line-soft font-display font-bold text-muted ${className}`}
        style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.38 }}
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <Image
      src={crestSrc(src)}
      alt=""
      width={size}
      height={size}
      loading="eager"
      fetchPriority={priority ? "high" : undefined}
      className={`shrink-0 border border-line bg-white object-contain ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}
