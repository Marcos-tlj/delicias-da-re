"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Layers, Minus, PackageCheck, Plus, Search, X } from "lucide-react";
import type { OptionList, Product, SelectedOptions, Unit } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { brl, numInput, parseNum, qty } from "@/lib/format";
import { Button, ErrorNote, Field, Input, Segmented, Select, cn } from "./ui";
import { MAX_LAYERS, groupListIds, isLayers, itemUnitCost, layerCount, layerKey, layeredPrice, readLayers } from "@/lib/layers";

/** Preço com centavos: 72,5 → "72,50"; 65 → "65". */
const money = (v: number) => {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
};

export type DraftItem = {
  key: string;
  product_id: string | null;
  product_name: string;
  unit: Unit;
  unit_price: number;
  quantity: number;
  options: SelectedOptions;
  note: string;
  /** quanto foi gasto no item inteiro (digitado no pedido); null = usa o cálculo do cadastro */
  cost_total: number | null;
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
  const [price, setPrice] = useState(editing ? money(editing.unit_price) : "");
  const [options, setOptions] = useState<SelectedOptions>(editing?.options ?? {});
  const [note, setNote] = useState(editing?.note ?? "");
  const [costInput, setCostInput] = useState(editing?.cost_total != null ? money(editing.cost_total) : "");
  const [error, setError] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);

  // camadas de recheio (bolo sob encomenda): um sabor por camada
  const layerGroup = product?.option_groups.find(isLayers) ?? null;
  const initialLayers = (p: Product | null, opts: SelectedOptions) => {
    const g = p?.option_groups.find(isLayers);
    if (!g) return [];
    const saved = readLayers(g.label, opts);
    return saved.length ? saved : Array<string>(layerCount(g)).fill("");
  };
  const [layers, setLayers] = useState<string[]>(() => initialLayers(initialProduct, editing?.options ?? {}));

  const changeLayers = (next: string[]) => {
    setLayers(next);
    if (!product || !layerGroup || priceTouched) return;
    const opts: SelectedOptions = {};
    next.forEach((v, i) => (opts[layerKey(layerGroup.label, i)] = v));
    const lp = layeredPrice(product.option_groups, opts, lists, Number(product.price));
    if (lp !== null) setPrice(money(lp));
  };

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
    setPrice(p ? money(p.price) : "");
    setOptions({});
    setLayers(initialLayers(p, {}));
    setCostInput("");
    setPriceTouched(false);
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
      if (isLayers(g)) {
        if (g.required && layers.some((l) => !l)) return setError(`Escolha o sabor de cada camada de ${g.label.toLowerCase()}.`);
        continue;
      }
      const v = options[g.label];
      if (g.required && (!v || (Array.isArray(v) && v.length === 0))) return setError(`Escolha: ${g.label}.`);
    }
    if (product?.stock_enabled && q > Number(product.stock_qty) && !editing)
      return setError(`Só há ${qty(product.stock_qty, product.unit)} de ${product.name} em estoque.`);

    // remove escolhas vazias
    const clean: SelectedOptions = {};
    for (const [k, v] of Object.entries(options)) {
      if (layerGroup && k.startsWith(`${layerGroup.label} (camada `)) continue;
      if (Array.isArray(v) ? v.length : v) clean[k] = v;
    }
    if (layerGroup) layers.forEach((v, i) => (clean[layerKey(layerGroup.label, i)] = v || "a definir"));
    onSave({
      key: editing?.key ?? "",
      product_id: product?.id ?? null,
      product_name: name.trim(),
      unit,
      unit_price: Math.max(0, p),
      quantity: q,
      options: clean,
      note,
      cost_total: costInput.trim() === "" ? null : Math.max(0, Math.round(parseNum(costInput) * 100) / 100),
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

              {(product?.option_groups ?? []).map((g) => {
                if (isLayers(g)) {
                  const groupLists = groupListIds(g)
                    .map(listById)
                    .filter((l): l is OptionList => !!l);
                  const avg = layeredPrice(product?.option_groups ?? [], Object.fromEntries(layers.map((v, i) => [layerKey(g.label, i), v])), lists, Number(product?.price ?? 0));
                  return (
                    <fieldset key={g.label} className="rounded-2xl border border-line p-3">
                      <legend className="px-1 text-[13px] font-semibold text-ink-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-brand" /> {g.label} em camadas
                        </span>
                      </legend>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[12.5px] text-ink-3">Iguais ou diferentes. Bolo de andares ou personalizado: mude o número de camadas.</p>
                        <div className="flex shrink-0 items-center rounded-xl border border-line">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center text-ink-2 hover:text-ink disabled:opacity-30"
                            disabled={layers.length <= 1}
                            onClick={() => changeLayers(layers.slice(0, -1))}
                            aria-label="Menos camadas"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="num w-8 text-center text-sm font-bold">{layers.length}</span>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center text-ink-2 hover:text-ink disabled:opacity-30"
                            disabled={layers.length >= MAX_LAYERS}
                            onClick={() => changeLayers([...layers, layers[layers.length - 1] ?? ""])}
                            aria-label="Mais camadas"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {layers.map((v, i) => (
                          <div key={i} className="grid grid-cols-[76px_1fr] items-center gap-2">
                            <span className="text-[13px] font-medium text-ink-2">Camada {i + 1}</span>
                            <Select value={v} onChange={(e) => changeLayers(layers.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Sabor da camada ${i + 1}`}>
                              <option value="">Escolha o sabor…</option>
                              {groupLists.map((l) => (
                                <optgroup key={l.id} label={`${l.name}${l.price_per_kg ? ` · ${brl(l.price_per_kg)}/kg` : ""}`}>
                                  {(l.option_items ?? [])
                                    .filter((it) => it.is_active || it.name === v)
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((it) => (
                                      <option key={it.id} value={it.name}>
                                        {it.name}
                                      </option>
                                    ))}
                                </optgroup>
                              ))}
                            </Select>
                          </div>
                        ))}
                      </div>
                      {avg !== null && (
                        <p className="num mt-2.5 text-[12.5px] text-ink-3">
                          Preço do kg pela média das camadas: <b className="text-ink">{brl(avg)}</b>
                          {priceTouched && " (você digitou outro preço abaixo)"}
                        </p>
                      )}
                    </fieldset>
                  );
                }
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
                  <Input
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      setPriceTouched(true);
                    }}
                    placeholder="0,00"
                  />
                </Field>
              </div>

              {(() => {
                // custo sugerido pelo cadastro (produto + sabores + embalagem), só como referência
                let suggested = 0;
                if (product) {
                  const opts: SelectedOptions = { ...options };
                  if (layerGroup) layers.forEach((v, i) => (opts[layerKey(layerGroup.label, i)] = v));
                  suggested = itemUnitCost(product, opts, lists, q) * (q > 0 ? q : 0);
                }
                const custom = costInput.trim() !== "";
                const total = custom ? Math.max(0, parseNum(costInput)) : suggested;
                const revenue = Math.max(0, p) * (q || 0);
                return (
                  <div className="rounded-2xl border border-line bg-bg/40 p-3">
                    <Field
                      label="Quanto você gastou neste item (R$)"
                      hint={
                        suggested > 0
                          ? custom
                            ? `Pelo cadastro seria ${brl(suggested)}.`
                            : `Vazio = usa o cálculo do cadastro: ${brl(suggested)}.`
                          : "Ingredientes, embalagem… do item inteiro (ex.: o bolo todo de 2 kg). Pode preencher depois, editando o pedido."
                      }
                    >
                      <Input inputMode="decimal" value={costInput} onChange={(e) => setCostInput(e.target.value)} placeholder={suggested > 0 ? money(suggested) : "0,00"} />
                    </Field>
                    {total > 0 && revenue > 0 && (
                      <p className="num mt-2 text-[12.5px] text-ink-3">
                        Lucro deste item: <b className={revenue - total < 0 ? "text-red-600" : "text-emerald-700"}>{brl(revenue - total)}</b>
                        {" "}({Math.round(((revenue - total) / revenue) * 100)}% do preço)
                      </p>
                    )}
                    {editing && custom && q !== editing.quantity && (
                      <p className="mt-1 text-[12.5px] text-amber-700">Você mudou a quantidade: confira se o custo continua certo.</p>
                    )}
                  </div>
                );
              })()}

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
