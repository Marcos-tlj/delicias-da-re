import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
      <span className="text-6xl">🍰</span>
      <h1 className="font-display mt-4 text-2xl font-semibold">Página não encontrada</h1>
      <Link href="/" className="mt-6 rounded-2xl bg-cocoa px-6 py-3 font-bold text-cream">
        Voltar ao cardápio
      </Link>
    </div>
  );
}
