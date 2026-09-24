"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Product } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { priceLabel } from "@/lib/format";
import ProductThumb from "@/components/ProductThumb";
import { setProductAvailability } from "../actions";

export default function ProductsAdmin({ products: initial }: { products: Product[] }) {
  const [products, setProducts] = useState(initial);
  const [, startTransition] = useTransition();

  const toggle = (p: Product) => {
    const next = !p.is_available;
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: next } : x)));
    startTransition(async () => {
      const res = await setProductAvailability(p.id, next);
      if (res.error) setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: !next } : x)));
    });
  };

  return (
    <div className="space-y-6 p-4">
      {CATEGORIES.map((c) => {
        const list = products.filter((p) => p.category === c.id);
        return (
          <section key={c.id}>
            <h2 className="font-display mb-2 text-lg font-semibold">
              {c.emoji} {c.label} <span className="text-sm font-normal text-cocoa-light">({list.length})</span>
            </h2>
            {list.length === 0 ? (
              <p className="rounded-3xl bg-white p-4 text-sm text-cocoa-light">Nenhum produto nesta categoria.</p>
            ) : (
              <ul className="divide-y divide-cream-dark overflow-hidden rounded-3xl bg-white">
                {list.map((p) => (
                  <li key={p.id} className={`flex items-center gap-3 p-3 ${p.is_available ? "" : "opacity-60"}`}>
                    <Link href={`/admin/produtos/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <ProductThumb src={p.image_url} alt={p.name} category={p.category} className="h-14 w-14" />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{p.name}</p>
                        <p className="text-sm text-berry">{priceLabel(Number(p.price), p.unit, p.price_is_from)}</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => toggle(p)}
                      role="switch"
                      aria-checked={p.is_available}
                      aria-label={p.is_available ? "Pausar" : "Ativar"}
                      className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                        p.is_available ? "bg-emerald-500" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                          p.is_available ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
