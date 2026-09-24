"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import type { Category, OptionGroup, OptionList, Product, Unit } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { numInput, parseNum } from "@/lib/format";
import { deleteProduct, saveProduct } from "../../actions";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Segmented, Select, Textarea, Toggle } from "@/components/ui";

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
        price: parseNum(price),
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
        <Card>
          <CardHeader title="Preço" />
          <div className="space-y-3 p-4 lg:p-5">
            <Field label={unit === "kg" ? "Preço por kg (R$)" : "Preço por unidade (R$)"}>
              <Input inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </Field>
            <Toggle checked={priceIsFrom} onChange={setPriceIsFrom} label="Preço “a partir de”" description="Lembra de conferir o valor no pedido" />
          </div>
        </Card>

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
