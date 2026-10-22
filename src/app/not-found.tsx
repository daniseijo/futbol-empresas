import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <h1 className="font-display text-6xl font-extrabold">FUERA DE JUEGO</h1>
      <p className="text-muted">No encontramos esa página. Puede que el equipo haya cambiado de nombre.</p>
      <Link href="/" className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent">
        Volver a la portada
      </Link>
    </main>
  );
}
