import Link from "next/link";

/** Section card with a title and, optionally, a link to the tab with the details. */
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
    <section className={`flex min-w-0 flex-col gap-2.5 card px-4 py-5 sm:p-5.5 ${className}`}>
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
