"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, PackageCheck, Plus, Search, X } from "lucide-react";
import type { OptionList, Product, SelectedOptions, Unit } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { brl, numInput, parseNum, qty } from "@/lib/format";
import { Button, ErrorNote, Field, Input, Segmented, cn } from "./ui";

export type DraftItem = {
  key: string;
  product_id: string | null;
  product_name: string;
  unit: Unit;
  unit_price: number;
  quantity: number;
  options: SelectedOptions;
  note: string;
};

export default function ItemDialog({
  products,
  lists,
  editing,
  onClose,
  onSave,
}: {
  products: Product[];
  lists: OptionList[];
  editing: DraftItem | null;
  onClose: () => void;
  onSave: (item: DraftItem) => void;
}) {
  const initialProduct = editing?.product_id ? products.find((p) => p.id === editing.product_id) ?? null : null;
  const [step, setStep] = useState<"pick" | "config">(editing ? "config" : "pick");
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [custom, setCustom] = useState(!!editing && !editing.product_id);
  const [search, setSearch] = useState("");

  const [name, setName] = useState(editing?.product_name ?? "");
  const [unit, setUnit] = useState<Unit>(editing?.unit ?? "un");
  const [quantity, setQuantity] = useState(editing ? numInput(editing.quantity) : "1");
  const [price, setPrice] = useState(editing ? numInput(editing.unit_price) : "");
  const [options, setOptions] = useState<SelectedOptions>(editing?.options ?? {});
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.is_active && (!q || p.name.toLowerCase().includes(q)));
  }, [products, search]);

  const choose = (p: Product | null) => {
    setProduct(p);
    setCustom(!p);
    setName(p?.name ?? "");
    setUnit(p?.unit ?? "un");
    setQuantity("1");
    setPrice(p ? numInput(p.price) : "");
    setOptions({});
    setNote("");
    setError("");
    setStep("config");
  };

  const listById = (id: string) => lists.find((l) => l.id === id);
  const step_ = unit === "kg" ? 0.5 : 1;
  const q = parseNum(quantity);
  const p = parseNum(price);

  const toggle = (label: string, choice: string, multi: boolean) =>
    setOptions((prev) => {
      if (!multi) return prev[label] === choice ? { ...prev, [label]: "" } : { ...prev, [label]: choice };
      const cur = Array.isArray(prev[label]) ? (prev[label] as string[]) : [];
      const next = cur.includes(choice) ? cur.filter((c) => c !== choice) : [...cur, choice];
      return { ...prev, [label]: next };
    });

  const save = () => {
    setError("");
    if (!name.trim()) return setError("Informe o nome do item.");
    if (!(q > 0)) return setError("Quantidade inválida.");
    for (const g of product?.option_groups ?? []) {
      const v = options[g.label];
      if (g.required && (!v || (Array.isArray(v) && v.length === 0))) return setError(`Escolha: ${g.label}.`);
    }
    if (product?.stock_enabled && q > Number(product.stock_qty) && !editing)
      return setError(`Só há ${qty(product.stock_qty, product.unit)} de ${product.name} em estoque.`);

    // remove escolhas vazias
    const clean: SelectedOptions = {};
    for (const [k, v] of Object.entries(options)) {
      if (Array.isArray(v) ? v.length : v) clean[k] = v;
    }
    onSave({
      key: editing?.key ?? "",
      product_id: product?.id ?? null,
      product_name: name.trim(),
      unit,
      unit_price: Math.max(0, p),
      quantity: q,
      options: clean,
      note,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal>
      <button className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fechar" />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[var(--shadow-pop)] sm:max-w-lg sm:rounded-3xl">
        {/* topo */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          {step === "config" && !editing && (
            <button onClick={() => setStep("pick")} className="rounded-lg p-1.5 text-ink-3 hover:bg-bg hover:text-ink" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <p className="flex-1 font-semibold">{step === "pick" ? "Escolha o produto" : editing ? "Editar item" : custom ? "Item avulso" : product?.name}</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-bg hover:text-ink" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "pick" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="p-4 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <Input className="pl-9" placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {CATEGORIES.map((c) => {
                const list = filtered.filter((x) => x.category === c.id);
                if (!list.length) return null;
                return (
                  <div key={c.id} className="mt-2">
                    <p className="px-3 py-1.5 text-xs font-bold tracking-wide text-ink-3 uppercase">{c.label}</p>
                    {list.map((x) => {
                      const out = x.stock_enabled && Number(x.stock_qty) <= 0;
                      return (
                        <button
                          key={x.id}
                          onClick={() => choose(x)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-bg"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{x.name}</p>
                            {x.stock_enabled && (
                              <p className={cn("inline-flex items-center gap-1 text-xs", out ? "text-red-600" : "text-emerald-700")}>
                                <PackageCheck className="h-3.5 w-3.5" />
                                {out ? "Sem estoque" : `${qty(x.stock_qty, x.unit)} pronto(s)`}
                              </p>
                            )}
                          </div>
                          <span className="num text-sm font-semibold text-ink-2">
                            {x.price_is_from && "a partir de "}
                            {brl(x.price)}
                            {x.unit === "kg" && "/kg"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <button
                onClick={() => choose(null)}
                className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-3 text-left text-ink-2 hover:bg-bg"
              >
                <Plus className="h-4 w-4" /> Item avulso (nome e preço livres)
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {custom && (
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <Field label="Nome do item">
                    <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                  </Field>
                  <Field label="Vendido por">
                    <Segmented
                      value={unit}
                      onChange={setUnit}
                      options={[
                        { value: "un", label: "Un." },
                        { value: "kg", label: "Kg" },
                      ]}
                    />
                  </Field>
                </div>
              )}

              {product?.option_groups.map((g) => {
                const list = listById(g.list_id);
                const choices = (list?.option_items ?? []).filter((i) => i.is_active).sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <fieldset key={g.label}>
                    <legend className="mb-2 flex w-full items-center justify-between">
                      <span className="text-[13px] font-semibold text-ink-2">{g.label}</span>
                      <span className="text-[11px] font-semibold text-ink-3">
                        {g.required ? "Obrigatório" : "Opcional"}
                        {g.multi && " · vários"}
                      </span>
                    </legend>
                    {choices.length === 0 ? (
                      <p className="text-[13px] text-ink-3">Lista vazia. Cadastre opções em Sabores.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {choices.map((c) => {
                          const cur = options[g.label];
                          const on = g.multi ? Array.isArray(cur) && cur.includes(c.name) : cur === c.name;
                          return (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => toggle(g.label, c.name, g.multi)}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition",
                                on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-line-strong",
                              )}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              })}

              <div className="grid grid-cols-2 gap-3">
                <Field label={unit === "kg" ? "Quantidade (kg)" : "Quantidade"}>
                  <div className="flex items-center rounded-xl border border-line">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center text-ink-2 hover:text-ink"
                      onClick={() => setQuantity(numInput(Math.max(step_, q - step_)))}
                      aria-label="Diminuir"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      className="num h-10 w-full min-w-0 bg-transparent text-center font-bold outline-none"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center text-ink-2 hover:text-ink"
                      onClick={() => setQuantity(numInput(q + step_))}
                      aria-label="Aumentar"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </Field>
                <Field label={`Preço ${unit === "kg" ? "por kg" : "unitário"} (R$)`}>
                  <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
                </Field>
              </div>

              <Field label="Observação do item">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: escrever “Parabéns, Ana!”" />
              </Field>

              {product?.stock_enabled && (
                <p className="text-[13px] text-ink-3">
                  Estoque atual: <b className="text-ink">{qty(product.stock_qty, product.unit)}</b>. Ao salvar o pedido, a quantidade sai do
                  estoque automaticamente.
                </p>
              )}
              <ErrorNote>{error}</ErrorNote>
            </div>
            <div className="pb-safe border-t border-line p-4">
              <Button variant="primary" size="lg" className="w-full justify-between" onClick={save}>
                <span>{editing ? "Salvar item" : "Adicionar ao pedido"}</span>
                <span className="num">{brl(Math.max(0, p) * (q || 0))}</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
