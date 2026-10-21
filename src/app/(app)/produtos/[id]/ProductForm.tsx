"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Plus, Trash2, X } from "lucide-react";
import type { Category, MarginMode, OptionGroup, OptionList, Product, Unit } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { brl, numInput, parseNum } from "@/lib/format";
import { calcPrice, pctFmt, profitOf } from "@/lib/pricing";
import { deleteProduct, saveProduct } from "../../actions";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Segmented, Select, Textarea, Toggle, cn } from "@/components/ui";

const PRESETS = [30, 50, 80, 100, 150, 200];

export default function ProductForm({ product, lists }: { product: Product | null; lists: OptionList[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<Category>(product?.category ?? "bolos");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? numInput(product.price) : "");
  const [unit, setUnit] = useState<Unit>(product?.unit ?? "un");
  const [priceIsFrom, setPriceIsFrom] = useState(product?.price_is_from ?? false);
  const [active, setActive] = useState(product?.is_active ?? true);
  const [stockEnabled, setStockEnabled] = useState(product?.stock_enabled ?? false);
  const [stockQty, setStockQty] = useState(product ? numInput(product.stock_qty) : "0");
  const [stockMin, setStockMin] = useState(product ? numInput(product.stock_min) : "0");
  const [sortOrder, setSortOrder] = useState(String(product?.sort_order ?? 0));
  const [groups, setGroups] = useState<OptionGroup[]>(product?.option_groups ?? []);

  // ---- custo e margem ----
  const [cost, setCost] = useState(product?.cost ? numInput(product.cost) : "");
  const [costItems, setCostItems] = useState<{ name: string; value: string }[]>(
    (product?.cost_items ?? []).map((c) => ({ name: c.name, value: numInput(c.value) })),
  );
  const [marginMode, setMarginMode] = useState<MarginMode>(product?.margin_mode ?? "markup");
  const [marginPct, setMarginPct] = useState<number>(product?.margin_pct ?? 100);
  const [rounding, setRounding] = useState<number>(product?.price_rounding ?? 0.5);
  const [priceAuto, setPriceAuto] = useState<boolean>(product ? product.price_auto : true);

  const costNum = costItems.length ? costItems.reduce((a, c) => a + parseNum(c.value), 0) : parseNum(cost);
  const suggested = calcPrice(costNum, marginPct, marginMode, rounding);
  const finalPrice = priceAuto && costNum > 0 ? suggested : parseNum(price);
  const result = profitOf(finalPrice, costNum);
  const maxPct = marginMode === "margin" ? 95 : 300;
  const setPct = (v: number) => setMarginPct(Math.max(0, Math.min(marginMode === "margin" ? 95 : 1000, Math.round(v * 100) / 100 || 0)));
  const updateCostItem = (i: number, patch: Partial<{ name: string; value: string }>) =>
    setCostItems((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const updateGroup = (i: number, patch: Partial<OptionGroup>) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await saveProduct({
        id: product?.id,
        name,
        category,
        description,
        price: finalPrice,
        cost: costNum,
        cost_items: costItems.map((c) => ({ name: c.name, value: parseNum(c.value) })),
        margin_pct: marginPct,
        margin_mode: marginMode,
        price_auto: priceAuto && costNum > 0,
        price_rounding: rounding,
        unit,
        price_is_from: priceIsFrom,
        is_active: active,
        stock_enabled: stockEnabled,
        stock_qty: parseNum(stockQty),
        stock_min: parseNum(stockMin),
        sort_order: Number(sortOrder) || 0,
        option_groups: groups,
      });
      if (r.error) return setError(r.error);
      router.push("/produtos");
      router.refresh();
    });
  };

  const remove = () => {
    if (!product || !window.confirm(`Excluir "${product.name}"? Pedidos antigos continuam com o nome salvo. Para só esconder, use "pausar".`)) return;
    start(async () => {
      const r = await deleteProduct(product.id);
      if (r.error) setError(r.error);
      else {
        router.push("/produtos");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_340px] lg:gap-6">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Informações" />
          <div className="space-y-4 p-4 lg:p-5">
            <Field label="Nome">
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bolo com Recheio Especial" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vendido por">
                <Segmented
                  value={unit}
                  onChange={setUnit}
                  options={[
                    { value: "un", label: "Unidade" },
                    { value: "kg", label: "Quilo (kg)" },
                  ]}
                />
              </Field>
            </div>
            <Field label="Descrição (opcional)">
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-2"><Calculator className="h-4 w-4 text-brand" /> Custo e preço</span>} subtitle="Informe quanto gasta para produzir e escolha a margem de lucro" />
          <div className="space-y-5 p-4 lg:p-5">
            <div className="space-y-2.5">
              <Field label={`Custo para produzir 1 ${unit === "kg" ? "kg" : "unidade"} (R$)`} hint={costItems.length ? "Soma dos itens abaixo." : "Ingredientes, embalagem, gás, sua mão de obra…"}>
                <Input inputMode="decimal" value={costItems.length ? numInput(costNum) : cost} readOnly={costItems.length > 0} onChange={(e) => setCost(e.target.value)} placeholder="0,00" className={cn(costItems.length > 0 && "bg-bg")} />
              </Field>
              {costItems.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2">
                  <Input value={c.name} onChange={(e) => updateCostItem(i, { name: e.target.value })} placeholder="Ex.: Leite condensado" aria-label="Item de custo" />
                  <Input inputMode="decimal" value={c.value} onChange={(e) => updateCostItem(i, { value: e.target.value })} placeholder="0,00" aria-label="Valor do item" />
                  <button type="button" onClick={() => setCostItems((cs) => cs.filter((_, j) => j !== i))} className="rounded-lg px-2.5 text-ink-3 hover:bg-red-50 hover:text-red-600" aria-label="Remover item">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCostItems((cs) => (cs.length === 0 && parseNum(cost) > 0 ? [{ name: "Custo base", value: cost }, { name: "", value: "" }] : [...cs, { name: "", value: "" }]))
                }
                className="text-[13px] font-semibold text-brand hover:text-brand-dark"
              >
                + {costItems.length ? "Adicionar item" : "Detalhar custo por item"}
              </button>
            </div>

            <Field label="Como calcular o lucro" hint={marginMode === "markup" ? `Soma a porcentagem ao custo: ${pctFmt(marginPct)} de ${brl(costNum)} = ${brl((costNum * marginPct) / 100)} de lucro.` : `O lucro vira ${pctFmt(marginPct)} do preço final. Ajuda a manter a margem mesmo dando desconto.`}>
              <Segmented
                value={marginMode}
                onChange={(m) => {
                  setMarginMode(m);
                  if (m === "margin" && marginPct > 95) setMarginPct(60);
                }}
                options={[
                  { value: "markup", label: "Sobre o custo" },
                  { value: "margin", label: "Sobre a venda" },
                ]}
              />
            </Field>

            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Porcentagem de lucro</span>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={maxPct} step={5} value={Math.min(marginPct, maxPct)} onChange={(e) => setPct(Number(e.target.value))} className="h-7 flex-1 accent-[var(--color-brand)]" aria-label="Porcentagem de lucro" />
                <div className="relative w-24 shrink-0">
                  <Input inputMode="decimal" value={String(marginPct).replace(".", ",")} onChange={(e) => setPct(parseNum(e.target.value))} className="pr-7 text-right" aria-label="Porcentagem" />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-3">%</span>
                </div>
              </div>
              <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                {PRESETS.filter((v) => marginMode === "markup" || v <= 95).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPct(v)}
                    className={cn("shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold ring-1 ring-inset transition", marginPct === v ? "bg-ink text-white ring-ink" : "text-ink-2 ring-line hover:bg-bg")}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Arredondar para cima">
                <Select value={String(rounding)} onChange={(e) => setRounding(Number(e.target.value))}>
                  <option value="0">Não arredondar</option>
                  <option value="0.1">R$ 0,10</option>
                  <option value="0.5">R$ 0,50</option>
                  <option value="1">R$ 1,00</option>
                </Select>
              </Field>
              <div className="rounded-xl bg-brand-soft px-3.5 py-2.5">
                <p className="text-[12.5px] font-semibold text-brand-dark">Preço sugerido</p>
                <p className="num font-display text-2xl font-bold text-brand-dark">{costNum > 0 ? brl(suggested) : "—"}</p>
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <Toggle
                checked={priceAuto}
                onChange={setPriceAuto}
                label="Usar o preço sugerido"
                description={priceAuto ? "O preço de venda acompanha o custo e a margem." : "Você define o preço de venda abaixo."}
              />
              {(!priceAuto || costNum <= 0) && (
                <Field label={unit === "kg" ? "Preço de venda por kg (R$)" : "Preço de venda por unidade (R$)"} className="mt-2">
                  <Input inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
                </Field>
              )}
              <div className="mt-3">
                <Toggle checked={priceIsFrom} onChange={setPriceIsFrom} label="Preço “a partir de”" description="Lembra de conferir o valor no pedido" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Escolhas do produto"
            subtitle="Ex.: Massa, Recheio, Cobertura — usando as listas de Sabores"
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => setGroups((g) => [...g, { label: "", list_id: lists[0]?.id ?? "", required: true, multi: false }])}
                disabled={lists.length === 0}
              >
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            }
          />
          <div className="space-y-3 p-4 lg:p-5">
            {lists.length === 0 && (
              <p className="text-[13px] text-ink-3">
                Crie listas em{" "}
                <Link href="/sabores" className="font-semibold text-brand">
                  Sabores e opções
                </Link>{" "}
                primeiro.
              </p>
            )}
            {groups.length === 0 && lists.length > 0 && <p className="text-[13px] text-ink-3">Sem escolhas: o produto é adicionado direto ao pedido.</p>}
            {groups.map((g, i) => (
              <div key={i} className="rounded-xl border border-line bg-bg/40 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr_auto]">
                  <Field label="Nome da escolha">
                    <Input value={g.label} onChange={(e) => updateGroup(i, { label: e.target.value })} placeholder="Recheio" />
                  </Field>
                  <Field label="Opções vêm da lista">
                    <Select value={g.list_id} onChange={(e) => updateGroup(i, { list_id: e.target.value })}>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <button
                    type="button"
                    onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}
                    className="self-end rounded-lg p-2.5 text-ink-3 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover escolha"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-ink" checked={g.required} onChange={(e) => updateGroup(i, { required: e.target.checked })} />
                    Obrigatório
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-ink" checked={g.multi} onChange={(e) => updateGroup(i, { multi: e.target.checked })} />
                    Pode escolher vários
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-5 lg:sticky lg:top-9 lg:self-start">
        <div className="hero-card rounded-3xl p-5 text-white">
          <p className="text-xs font-semibold tracking-[0.08em] text-white/70 uppercase">Preço de venda</p>
          <p className="num font-display mt-1 text-4xl font-bold">
            {brl(finalPrice)}
            <span className="ml-1 text-base font-medium text-white/70">/{unit}</span>
          </p>
          <div className="num mt-4 grid grid-cols-3 gap-2">
            {[
              { l: "Custo", v: costNum > 0 ? brl(costNum) : "—" },
              { l: "Lucro", v: costNum > 0 ? brl(result.profit) : "—" },
              { l: "Margem", v: costNum > 0 && finalPrice > 0 ? pctFmt(result.margin) : "—" },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl bg-white/10 px-2.5 py-2">
                <p className="text-[11.5px] text-white/70">{k.l}</p>
                <p className={cn("text-[14px] font-bold whitespace-nowrap", k.l === "Lucro" && result.profit < 0 && "text-red-200")}>{k.v}</p>
              </div>
            ))}
          </div>
          {costNum <= 0 && <p className="mt-3 text-[12.5px] text-white/75">Informe o custo para ver o lucro de cada venda.</p>}
          {costNum > 0 && !priceAuto && <p className="mt-3 text-[12.5px] text-white/75">Com esse preço, o lucro é de {pctFmt(result.markup)} sobre o custo.</p>}
        </div>

        <Card>
          <CardHeader title="Estoque" />
          <div className="space-y-3 p-4 lg:p-5">
            <Toggle
              checked={stockEnabled}
              onChange={setStockEnabled}
              label="Controlar estoque"
              description="Para itens prontos. Pedidos dão baixa sozinhos."
            />
            {stockEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Disponível (${unit})`}>
                  <Input inputMode="decimal" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
                </Field>
                <Field label="Avisar abaixo de">
                  <Input inputMode="decimal" value={stockMin} onChange={(e) => setStockMin(e.target.value)} />
                </Field>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-2 p-4 lg:p-5">
            <Toggle checked={active} onChange={setActive} label="Produto ativo" description="Pausado não aparece ao criar pedidos" />
            <Field label="Ordem na lista" hint="Números menores aparecem primeiro.">
              <Input inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </Field>
          </div>
        </Card>

        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button variant="primary" size="lg" className="flex-1" disabled={pending}>
            {pending ? "Salvando…" : product ? "Salvar produto" : "Criar produto"}
          </Button>
          {product && (
            <Button type="button" variant="danger" size="lg" onClick={remove} disabled={pending} aria-label="Excluir produto">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
