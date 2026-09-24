"use client";

import { useEffect, useState } from "react";
import type { Product, SelectedOptions } from "@/lib/types";
import { brl, formatQty, priceLabel } from "@/lib/format";
import { useCart } from "@/lib/cart";
import ProductThumb from "./ProductThumb";

export default function ProductSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { add } = useCart();
  const [qty, setQty] = useState(product.min_quantity);
  const [opts, setOpts] = useState<SelectedOptions>({});
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  // trava a rolagem do fundo enquanto o sheet está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const missing = product.options.filter((g) => {
    if (!g.required) return false;
    const v = opts[g.name];
    return !v || (Array.isArray(v) && v.length === 0);
  });

  const toggle = (group: string, choice: string, multi: boolean) => {
    setOpts((prev) => {
      if (!multi) return { ...prev, [group]: choice };
      const cur = (prev[group] as string[] | undefined) ?? [];
      const next = cur.includes(choice) ? cur.filter((c) => c !== choice) : [...cur, choice];
      const copy = { ...prev };
      if (next.length) copy[group] = next;
      else delete copy[group];
      return copy;
    });
  };

  const step = product.quantity_step;
  const round = (n: number) => Math.round(n * 100) / 100;

  const submit = () => {
    if (missing.length) {
      setShowErrors(true);
      return;
    }
    add(product, qty, opts, note);
    if (navigator.vibrate) navigator.vibrate(30);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal aria-label={product.name}>
      <button className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fechar" />
      <div className="animate-sheet-up relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-cream">
        <div className="overflow-y-auto px-5 pt-3 pb-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-cream-dark" />
          <ProductThumb
            src={product.image_url}
            alt={product.name}
            category={product.category}
            className="h-48 w-full"
          />
          <h2 className="font-display mt-4 text-2xl font-semibold">{product.name}</h2>
          {product.description && <p className="mt-1 text-cocoa-light">{product.description}</p>}
          <p className="mt-2 text-lg font-bold text-berry">
            {priceLabel(product.price, product.unit, product.price_is_from)}
          </p>

          {product.options.map((g) => {
            const multi = g.type === "multi";
            const isMissing = showErrors && missing.some((m) => m.name === g.name);
            return (
              <fieldset key={g.name} className="mt-5">
                <legend className="flex w-full items-center justify-between">
                  <span className="font-bold">{g.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      g.required
                        ? isMissing
                          ? "bg-berry text-white"
                          : "bg-cocoa text-cream"
                        : "bg-cream-dark text-cocoa-light"
                    }`}
                  >
                    {g.required ? "Obrigatório" : multi ? "Opcional · vários" : "Opcional"}
                  </span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.choices.map((c) => {
                    const cur = opts[g.name];
                    const on = multi ? Array.isArray(cur) && cur.includes(c) : cur === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => toggle(g.name, c, multi)}
                        aria-pressed={on}
                        className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                          on ? "border-cocoa bg-cocoa text-cream" : "border-cream-dark bg-white text-cocoa"
                        }`}
                      >
                        {on && "✓ "}
                        {c}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <label className="mt-5 block">
            <span className="font-bold">Alguma observação?</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Ex.: escrever “Parabéns, Ana!” no bolo"
              className="mt-2 w-full rounded-2xl border border-cream-dark bg-white p-3 outline-none focus:border-cocoa"
            />
          </label>
        </div>

        <div className="pb-safe flex items-center gap-3 border-t border-cream-dark bg-white px-5 pt-3">
          <div className="flex items-center rounded-2xl border border-cream-dark">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(product.min_quantity, round(q - step)))}
              className="h-12 w-11 text-2xl text-berry disabled:opacity-30"
              disabled={qty <= product.min_quantity}
              aria-label="Diminuir"
            >
              −
            </button>
            <span className="min-w-14 text-center font-bold">{formatQty(qty, product.unit)}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(100, round(q + step)))}
              className="h-12 w-11 text-2xl text-berry"
              aria-label="Aumentar"
            >
              +
            </button>
          </div>
          <button
            onClick={submit}
            className="flex h-12 flex-1 items-center justify-between rounded-2xl bg-berry px-4 font-bold text-white active:bg-berry-dark"
          >
            <span>Adicionar</span>
            <span>{brl(product.price * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
