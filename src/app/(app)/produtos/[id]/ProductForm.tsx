"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Plus, Trash2, Wheat, X } from "lucide-react";
import type { Category, Ingredient, IngredientUnit, MarginMode, OptionGroup, OptionList, Product, Unit } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { brl, numInput, parseNum } from "@/lib/format";
import { calcPrice, pctFmt, profitOf } from "@/lib/pricing";
import { compatibleUnits, lineCost, productCost, recipeCost, unitInfo } from "@/lib/ingredients";
import IngredientForm from "@/components/IngredientForm";
import Sheet from "@/components/Sheet";
import { deleteProduct, saveProduct } from "../../actions";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Segmented, Select, Textarea, Toggle, cn } from "@/components/ui";

const PRESETS = [30, 50, 80, 100, 150, 200];
const NEW_INGREDIENT = "__novo__";

type RecipeRow = { ingredient_id: string; qty: string; unit: IngredientUnit };

/** Unidade sugerida para medir na receita: g para quem compra em kg, ml para quem compra em L. */
const measureUnitFor = (ing?: Ingredient): IngredientUnit => (ing ? (unitInfo(ing.unit).base as IngredientUnit) : "g");

export default function ProductForm({
  product,
  lists,
  ingredients,
}: {
  product: Product | null;
  lists: OptionList[];
  ingredients: Ingredient[];
}) {
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

  // ---- receita (ingredientes usados) ----
  const [added, setAdded] = useState<Ingredient[]>([]);
  const allIngs = useMemo(() => {
    const m = new Map(ingredients.map((i) => [i.id, i] as const));
    for (const a of added) m.set(a.id, a);
    return m;
  }, [ingredients, added]);
  const sortedIngs = useMemo(() => [...allIngs.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [allIngs]);
  const [recipe, setRecipe] = useState<RecipeRow[]>(
    (product?.recipe ?? []).map((l) => ({ ingredient_id: l.ingredient_id, qty: numInput(l.qty), unit: l.unit })),
  );
  const [recipeYield, setRecipeYield] = useState(product?.recipe_yield ? numInput(product.recipe_yield) : "1");
  const [newForRow, setNewForRow] = useState<number | null>(null);
  const updateRecipe = (i: number, patch: Partial<RecipeRow>) => setRecipe((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const pickIngredient = (i: number, id: string) => {
    if (id === NEW_INGREDIENT) return setNewForRow(i);
    updateRecipe(i, { ingredient_id: id, unit: measureUnitFor(allIngs.get(id)) });
  };

  const yieldNum = parseNum(recipeYield) > 0 ? parseNum(recipeYield) : 1;
  const rc = recipeCost(
    recipe.filter((r) => r.ingredient_id).map((r) => ({ ingredient_id: r.ingredient_id, qty: parseNum(r.qty), unit: r.unit })),
    allIngs,
    yieldNum,
  );
  const extrasNum = costItems.reduce((a, c) => a + parseNum(c.value), 0);
  const hasDetail = recipe.length > 0 || costItems.length > 0;
  const costNum = hasDetail ? productCost(rc.perUnit, costItems.map((c) => ({ value: parseNum(c.value) }))) : parseNum(cost);
  const unitWord = unit === "kg" ? "kg" : "unidade";
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
        recipe: recipe
          .filter((r) => r.ingredient_id && parseNum(r.qty) > 0)
          .map((r) => ({ ingredient_id: r.ingredient_id, qty: parseNum(r.qty), unit: r.unit })),
        recipe_yield: yieldNum,
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
            {/* ---------- Receita ---------- */}
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                  <Wheat className="h-3.5 w-3.5 text-brand" /> Ingredientes da receita
                </span>
                {recipe.length > 0 && <span className="num text-[13px] font-semibold text-ink-2">{brl(rc.total)}</span>}
              </div>
              {recipe.length === 0 && (
                <p className="text-[13px] text-ink-3">
                  Escolha os ingredientes cadastrados em{" "}
                  <Link href="/ingredientes" className="font-semibold text-brand">
                    Ingredientes
                  </Link>{" "}
                  e diga quanto usou. O custo é calculado pelo preço que você pagou.
                </p>
              )}
              {recipe.map((r, i) => {
                const ing = allIngs.get(r.ingredient_id);
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg/40 p-2 sm:flex-nowrap sm:border-0 sm:bg-transparent sm:p-0">
                    <Select
                      value={r.ingredient_id}
                      onChange={(e) => pickIngredient(i, e.target.value)}
                      className="w-full min-w-0 sm:w-auto sm:flex-1"
                      aria-label="Ingrediente"
                    >
                      <option value="" disabled>
                        Escolha o ingrediente…
                      </option>
                      {sortedIngs.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                      <option value={NEW_INGREDIENT}>+ Cadastrar novo ingrediente</option>
                    </Select>
                    <div className="min-w-0 flex-1 sm:w-24 sm:flex-none">
                      <Input inputMode="decimal" value={r.qty} onChange={(e) => updateRecipe(i, { qty: e.target.value })} placeholder="Qtd." aria-label="Quantidade usada" />
                    </div>
                    <Select value={r.unit} onChange={(e) => updateRecipe(i, { unit: e.target.value as IngredientUnit })} className="w-[76px] shrink-0" aria-label="Medida">
                      {(ing ? compatibleUnits(ing.unit) : compatibleUnits(r.unit)).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </Select>
                    <span className="num w-[76px] shrink-0 text-right text-[13px] font-semibold text-ink-2">{ing ? brl(lineCost(ing, parseNum(r.qty), r.unit)) : "—"}</span>
                    <button type="button" onClick={() => setRecipe((rs) => rs.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-ink-3 hover:bg-red-50 hover:text-red-600" aria-label="Remover ingrediente">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setRecipe((rs) => [...rs, { ingredient_id: "", qty: "", unit: "g" }])}
                className="text-[13px] font-semibold text-brand hover:text-brand-dark"
              >
                + Adicionar ingrediente
              </button>

              {recipe.length > 0 && (
                <Field
                  label="Essa receita rende"
                  hint={yieldNum !== 1 ? `${brl(rc.total)} ÷ ${numInput(yieldNum)} = ${brl(rc.perUnit)} de ingredientes por ${unitWord}.` : `Ex.: uma receita de brigadeiro que rende 40 unidades → digite 40.`}
                  className="pt-1"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-28">
                      <Input inputMode="decimal" value={recipeYield} onChange={(e) => setRecipeYield(e.target.value)} aria-label="Rendimento" />
                    </div>
                    <span className="text-[13px] text-ink-2">{unit === "kg" ? "kg" : yieldNum === 1 ? "unidade" : "unidades"}</span>
                  </div>
                </Field>
              )}
            </div>

            {/* ---------- Outros custos ---------- */}
            <div className="space-y-2.5 border-t border-line pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink-2">Outros custos por {unitWord}</span>
                {costItems.length > 0 && <span className="num text-[13px] font-semibold text-ink-2">{brl(extrasNum)}</span>}
              </div>
              {costItems.length === 0 && <p className="text-[13px] text-ink-3">Embalagem, gás, mão de obra… o que não entra na receita.</p>}
              {costItems.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2">
                  <Input value={c.name} onChange={(e) => updateCostItem(i, { name: e.target.value })} placeholder="Ex.: Caixa e fita" aria-label="Item de custo" />
                  <Input inputMode="decimal" value={c.value} onChange={(e) => updateCostItem(i, { value: e.target.value })} placeholder="0,00" aria-label="Valor do item" />
                  <button type="button" onClick={() => setCostItems((cs) => cs.filter((_, j) => j !== i))} className="rounded-lg px-2.5 text-ink-3 hover:bg-red-50 hover:text-red-600" aria-label="Remover item">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCostItems((cs) =>
                    cs.length === 0 && recipe.length === 0 && parseNum(cost) > 0 ? [{ name: "Custo base", value: cost }, { name: "", value: "" }] : [...cs, { name: "", value: "" }],
                  )
                }
                className="text-[13px] font-semibold text-brand hover:text-brand-dark"
              >
                + Adicionar custo
              </button>
            </div>

            {/* ---------- Total ---------- */}
            {hasDetail ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink-2">Custo para produzir 1 {unitWord}</p>
                  {recipe.length > 0 && costItems.length > 0 && (
                    <p className="num text-xs text-ink-3">
                      Ingredientes {brl(rc.perUnit)} + outros {brl(extrasNum)}
                    </p>
                  )}
                </div>
                <p className="num font-display text-xl font-bold">{brl(costNum)}</p>
              </div>
            ) : (
              <Field label={`Ou digite o custo de 1 ${unitWord} direto (R$)`} hint="Se preferir não montar a receita.">
                <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" />
              </Field>
            )}

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

      {newForRow !== null && (
        <Sheet title="Novo ingrediente" onClose={() => setNewForRow(null)}>
          <IngredientForm
            onDone={(saved) => {
              if (saved) {
                setAdded((a) => [...a, saved]);
                updateRecipe(newForRow, { ingredient_id: saved.id, unit: measureUnitFor(saved) });
              }
              setNewForRow(null);
            }}
          />
        </Sheet>
      )}
    </form>
  );
}
