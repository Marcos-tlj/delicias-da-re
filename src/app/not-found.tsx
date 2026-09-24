import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-display text-2xl">Página não encontrada</p>
      <Link href="/" className="rounded-xl bg-ink px-4 py-2.5 font-semibold text-white">
        Voltar ao início
      </Link>
    </div>
  );
}
