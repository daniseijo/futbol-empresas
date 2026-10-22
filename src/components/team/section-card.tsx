import Link from "next/link";

/** Tarjeta de sección con título y, opcionalmente, un enlace a la pestaña con el detalle. */
export function SectionCard({
  title,
  link,
  aside,
  className = "",
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-2.5 rounded-[22px] border border-line bg-surface p-5.5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-[28px] leading-tight font-extrabold uppercase">{title}</h2>
        {link ? (
          <Link href={link.href} className="text-sm font-semibold text-accent-text hover:underline">
            {link.label}
          </Link>
        ) : (
          aside
        )}
      </div>
      {children}
    </section>
  );
}
