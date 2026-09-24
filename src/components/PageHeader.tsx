import Link from "next/link";

export default function PageHeader({ title, back }: { title: string; back?: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-cream-dark bg-cream/95 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur">
      {back ? (
        <Link href={back} className="flex h-10 w-10 items-center justify-center rounded-full text-2xl active:bg-cream-dark" aria-label="Voltar">
          ‹
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="font-display text-xl font-semibold">{title}</h1>
    </header>
  );
}
