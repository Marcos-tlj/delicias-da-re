"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { brl, formatQty, optionsText } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

export default function CartPage() {
  const { items, subtotal, ready, setQuantity, remove } = useCart();
  const hasFrom = items.some((i) => i.priceIsFrom);
  const hasExtras = items.some((i) => Object.keys(i.options).some((k) => k.includes("combinar")));

  return (
    <div className="pb-48">
      <PageHeader title="Sua sacola" back="/" />

      {ready && items.length === 0 && (
        <div className="flex flex-col items-center px-8 pt-20 text-center">
          <span className="text-6xl">🧁</span>
          <p className="mt-4 font-bold">Sua sacola está vazia</p>
          <p className="mt-1 text-sm text-cocoa-light">Que tal um bolo de brigadeiro?</p>
          <Link href="/" className="mt-6 rounded-2xl bg-cocoa px-6 py-3 font-bold text-cream">
            Ver cardápio
          </Link>
        </div>
      )}

      <ul className="space-y-3 p-4">
        {items.map((i) => (
          <li key={i.key} className="rounded-3xl bg-white p-4">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{i.name}</p>
                {optionsText(i.options) && <p className="mt-0.5 text-sm text-cocoa-light">{optionsText(i.options)}</p>}
                {i.note && <p className="mt-0.5 text-sm text-cocoa-light italic">“{i.note}”</p>}
              </div>
              <p className="shrink-0 font-bold">{brl(i.price * i.quantity)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button onClick={() => remove(i.key)} className="text-sm font-semibold text-berry">
                Remover
              </button>
              <div className="flex items-center rounded-xl border border-cream-dark">
                <button
                  onClick={() => setQuantity(i.key, i.quantity - i.step)}
                  className="h-9 w-9 text-xl text-berry"
                  aria-label="Diminuir"
                >
                  −
                </button>
                <span className="min-w-14 text-center text-sm font-bold">{formatQty(i.quantity, i.unit)}</span>
                <button
                  onClick={() => setQuantity(i.key, Math.min(100, i.quantity + i.step))}
                  className="h-9 w-9 text-xl text-berry"
                  aria-label="Aumentar"
                >
                  +
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length > 0 && (
        <>
          {(hasFrom || hasExtras) && (
            <p className="mx-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              {hasExtras && "Adicionais escolhidos têm valor a combinar. "}
              {hasFrom && "Alguns itens têm preço “a partir de”. "}
              Confirmamos o valor final pelo WhatsApp.
            </p>
          )}
          <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-20 px-3">
            <div className="mx-auto max-w-md rounded-3xl bg-white p-4 shadow-lg">
              <div className="flex justify-between text-lg font-bold">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              <Link
                href="/checkout"
                className="mt-3 block rounded-2xl bg-berry py-3.5 text-center font-bold text-white active:bg-berry-dark"
              >
                Continuar
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
