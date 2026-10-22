import type { Outcome } from "@/lib/sportspress/types";

const LABEL: Record<Outcome, string> = { V: "Victoria", E: "Empate", D: "Derrota" };
const STYLE: Record<Outcome, string> = {
  V: "bg-ink text-white",
  E: "bg-line-soft text-ink",
  D: "bg-loss-soft text-loss",
};

export function OutcomeBadge({ outcome, size = 28 }: { outcome: Outcome; size?: number }) {
  return (
    <span
      title={LABEL[outcome]}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${STYLE[outcome]}`}
      style={{ width: size, height: size }}
    >
      {outcome}
      <span className="sr-only"> ({LABEL[outcome]})</span>
    </span>
  );
}

export function FormBadges({ form, size = 22 }: { form: Outcome[]; size?: number }) {
  if (form.length === 0) return <span className="text-sm text-muted">—</span>;
  return (
    <span className="inline-flex gap-1">
      {form.map((outcome, index) => (
        <OutcomeBadge key={index} outcome={outcome} size={size} />
      ))}
    </span>
  );
}
