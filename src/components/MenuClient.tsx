"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Product } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { priceLabel } from "@/lib/format";
import ProductThumb from "./ProductThumb";
import ProductSheet from "./ProductSheet";
import CartBar from "./CartBar";

export default function MenuClient({ products, loadError }: { products: Product[]; loadError: boolean }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [active, setActive] = useState<Category>("bolos");
  const sectionRefs = useRef<Partial<Record<Category, HTMLElement | null>>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const sections = CATEGORIES.map((c) => ({
    ...c,
    items: filtered.filter((p) => p.category === c.id),
  })).filter((s) => s.items.length > 0);

  // Destaca a categoria visível enquanto rola
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.getAttribute("data-cat") as Category);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [sections.length]);

  const goTo = (cat: Category) => {
    const el = sectionRefs.current[cat];
    if (el) window.scrollTo({ top: el.offsetTop - 110, behavior: "smooth" });
  };

  return (
    <div className="pb-40">
      {/* Cabeçalho */}
      <header className="bg-cocoa px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-6 text-cream">
        <p className="text-sm opacity-80">Bolos, doces e tortas caseiros</p>
        <h1 className="font-display text-3xl font-semibold">Delícias da Rê</h1>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-cocoa">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-cocoa-light" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar bolo, recheio, tortinha…"
            className="w-full bg-transparent outline-none placeholder:text-cocoa-light/60"
            aria-label="Buscar no cardápio"
          />
        </div>
      </header>

      {/* Chips de categoria */}
      <nav className="no-scrollbar sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-cream-dark bg-cream/95 px-4 py-3 backdrop-blur">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              active === s.id ? "bg-cocoa text-cream" : "bg-white text-cocoa"
            }`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </nav>

      {loadError && (
        <p className="m-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          Não conseguimos carregar o cardápio agora. Tente novamente em instantes.
        </p>
      )}

      {!loadError && sections.length === 0 && (
        <p className="p-8 text-center text-cocoa-light">
          {query ? "Nada encontrado para essa busca." : "Cardápio em atualização. Volte daqui a pouco!"}
        </p>
      )}

      {sections.map((s) => (
        <section
          key={s.id}
          data-cat={s.id}
          ref={(el) => {
            sectionRefs.current[s.id] = el;
          }}
          className="px-4 pt-6"
        >
          <h2 className="font-display mb-3 text-xl font-semibold">{s.label}</h2>
          <ul className="divide-y divide-cream-dark overflow-hidden rounded-3xl bg-white">
            {s.items.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p)}
                  className="flex w-full items-center gap-3 p-4 text-left active:bg-cream"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold leading-tight">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-cocoa-light">{p.description}</p>
                    )}
                    <p className="mt-2 font-bold text-berry">
                      {priceLabel(p.price, p.unit, p.price_is_from)}
                    </p>
                  </div>
                  <ProductThumb src={p.image_url} alt={p.name} category={p.category} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="px-6 pt-8 text-center text-xs text-cocoa-light">
        Adicionais e decorações especiais com valor a combinar pelo WhatsApp.
      </p>

      <CartBar />
      {selected && <ProductSheet product={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
