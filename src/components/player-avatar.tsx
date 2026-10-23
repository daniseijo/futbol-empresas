import Image from "next/image";
import type { Position } from "@/lib/sportspress/types";
import { initials } from "./crest";

const POSITION_STYLE: Record<Position, string> = {
  POR: "bg-ink text-white",
  DEF: "bg-line-soft text-ink",
  MED: "bg-accent text-on-accent",
  DEL: "bg-accent-soft text-accent-text",
};

/**
 * The player's photo if there is one; otherwise their shirt number on their
 * position's colour; and without a number, their initials. Always the same
 * size and shape.
 */
export function PlayerAvatar({
  name,
  photoUrl,
  number,
  position,
  size = 40,
}: {
  name: string;
  photoUrl: string | null;
  number: string | null;
  position: Position | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover object-top"
        style={{ width: size, height: size }}
      />
    );
  }
  const style = position ? POSITION_STYLE[position] : "bg-line-soft text-muted";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ${style}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {number ?? initials(name)}
    </span>
  );
}
