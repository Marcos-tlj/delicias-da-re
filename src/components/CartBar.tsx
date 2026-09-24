"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/format";

export default function CartBar() {
  const { items, subtotal, ready } = useCart();
  if (!ready || items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-20 px-3">
      <Link
        href="/carrinho"
        className="animate-pop mx-auto flex max-w-md items-center justify-between rounded-2xl bg-berry px-4 py-3.5 text-white shadow-lg shadow-berry/30 active:scale-[0.98]"
      >
        <span className="rounded-lg bg-white/20 px-2 py-0.5 text-sm font-bold">{items.length}</span>
        <span className="font-bold">Ver sacola</span>
        <span className="font-bold">{brl(subtotal)}</span>
      </Link>
    </div>
  );
}
