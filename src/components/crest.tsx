import Image from "next/image";

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

/** A team's crest. Without one, shows its initials in the same shape. */
export function Crest({
  src,
  name,
  size = 32,
  className = "",
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
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
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 border border-line bg-white object-contain ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}
