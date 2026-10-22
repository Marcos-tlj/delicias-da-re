"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Ingredient, IngredientUnit } from "@/lib/types";
import { brl, numInput, parseNum } from "@/lib/format";
import { UNITS, costPerBase, refPrice, unitInfo } from "@/lib/ingredients";
import { deleteIngredient, saveIngredient } from "@/app/(app)/actions";
import { Button, ErrorNote, Field, Input, Select } from "./ui";

const fmtSmall = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: v < 0.1 ? 4 : 2 });

/**
 * Cadastro de um ingrediente comprado: nome, quanto vem na embalagem e quanto custou.
 * `usedIn` = nomes dos produtos que usam esse ingrediente (para avisar o recálculo).
 */
export default function IngredientForm({
  ingredient,
  usedIn = [],
  initialName = "",
  onDone,
}: {
  ingredient?: Ingredient;
  usedIn?: string[];
  initialName?: string;
  onDone: (saved?: Ingredient, info?: { updated: number }) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(ingredient?.name ?? initialName);
  const [qty, setQty] = useState(ingredient ? numInput(ingredient.package_qty) : "");
  const [unit, setUnit] = useState<IngredientUnit>(ingredient?.unit ?? "g");
  const [price, setPrice] = useState(ingredient ? numInput(ingredient.package_price) : "");
  const [notes, setNotes] = useState(ingredient?.notes ?? "");

  const draft = { unit, package_qty: parseNum(qty), package_price: parseNum(price) };
  const ready = draft.package_qty > 0 && draft.package_price > 0;
  const ref = refPrice(draft);
  const base = unitInfo(unit).base;
  const priceChanged = ingredient && (ingredient.package_price !== draft.package_price || ingredient.package_qty !== draft.package_qty || ingredient.unit !== unit);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // pode estar dentro do formulário do produto
    setError("");
    start(async () => {
      const r = await saveIngredient({ id: ingredient?.id, name, unit, package_qty: draft.package_qty, package_price: draft.package_price, notes });
      if (r.error || !r.id) return setError(r.error ?? "Erro ao salvar.");
      onDone(
        { id: r.id, name: name.trim(), unit, package_qty: draft.package_qty, package_price: draft.package_price, notes: notes.trim() || null, updated_at: new Date().toISOString() },
        { updated: r.updated ?? 0 },
      );
      router.refresh();
    });
  };

  const remove = () => {
    if (!ingredient || !window.confirm(`Excluir "${ingredient.name}"?`)) return;
    start(async () => {
      const r = await deleteIngredient(ingredient.id);
      if (r.error) return setError(r.error);
      onDone();
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <Field label="Ingrediente">
        <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Leite condensado Moça" maxLength={80} />
      </Field>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Quanto vem na embalagem">
          <Input inputMode="decimal" required value={qty} onChange={(e) => setQty(e.target.value)} placeholder={base === "un" ? "Ex.: 12" : "Ex.: 395"} />
        </Field>
        <Field label="Medida">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)}>
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Preço pago (R$)">
        <Input inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
      </Field>

      <div className="rounded-xl bg-brand-soft px-3.5 py-3">
        {ready ? (
          <>
            <p className="num font-display text-xl font-bold text-brand-dark">
              {brl(ref.value)}
              <span className="ml-1 text-sm font-medium">/{ref.label}</span>
            </p>
            {base !== "un" && <p className="num text-[12.5px] text-brand-dark/80">{fmtSmall(costPerBase(draft))} por {base}</p>}
          </>
        ) : (
          <p className="text-[13px] text-brand-dark/80">Preencha quantidade e preço para ver quanto sai cada {base === "un" ? "unidade" : base === "g" ? "grama" : "ml"}.</p>
        )}
      </div>

      <Field label="Observação (opcional)">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Atacadão, marca X" maxLength={200} />
      </Field>

      {ingredient && usedIn.length > 0 && (
        <p className="text-[12.5px] text-ink-3">
          {priceChanged ? "Ao salvar, o custo será recalculado em: " : "Usado em: "}
          <span className="font-semibold text-ink-2">{usedIn.join(", ")}</span>
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2 pt-1">
        <Button variant="primary" size="lg" className="flex-1" disabled={pending}>
          {pending ? "Salvando…" : ingredient ? "Salvar ingrediente" : "Adicionar ingrediente"}
        </Button>
        {ingredient && (
          <Button type="button" variant="danger" size="lg" onClick={remove} disabled={pending} aria-label="Excluir ingrediente">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
