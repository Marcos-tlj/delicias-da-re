"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Ingredient, OptionItem } from "@/lib/types";
import { brl, numInput, parseNum } from "@/lib/format";
import { recipeCost } from "@/lib/ingredients";
import { saveFlavorRecipe } from "../actions";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import Sheet from "@/components/Sheet";
import IngredientForm from "@/components/IngredientForm";
import CostLines, { type CostRow, measureUnitFor, toLines } from "../produtos/[id]/CostLines";

/** Custo do sabor por kg (ou unidade): mostra com centavos, ou mais casas se for pequeno. */
export const flavorCostLabel = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.1 ? 4 : 2 });

/**
 * Receita do sabor (ex.: recheio de brigadeiro) e para quantos kg de bolo ela dá.
 * Custo do sabor por kg = custo da receita ÷ kg. Entra no custo de cada pedido pelo peso.
 */
export default function FlavorCost({ item, listName, ingredients, onClose }: { item: OptionItem; listName: string; ingredients: Ingredient[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Ingredient[]>([]);
  const items = useMemo(() => {
    const m = new Map(ingredients.map((i) => [i.id, i] as const));
    for (const a of added) m.set(a.id, a);
    return m;
  }, [ingredients, added]);
  const [rows, setRows] = useState<CostRow[]>((item.recipe ?? []).map((l) => ({ ingredient_id: l.ingredient_id, qty: numInput(l.qty), unit: l.unit })));
  const [yieldQty, setYieldQty] = useState(item.recipe_yield ? numInput(item.recipe_yield) : "1");
  const [newRow, setNewRow] = useState<number | null>(null);

  const y = parseNum(yieldQty) > 0 ? parseNum(yieldQty) : 1;
  const rc = recipeCost(toLines(rows), items, y);

  const save = () => {
    setError("");
    start(async () => {
      const r = await saveFlavorRecipe(item.id, toLines(rows), y);
      if (r.error) return setError(r.error);
      router.refresh();
      onClose();
    });
  };

  return (
    <Sheet title={`Custo: ${item.name}`} onClose={onClose}>
      <div className="space-y-4 p-5">
        <p className="text-[13px] text-ink-3">
          Ingredientes que só esse sabor usa ({listName.toLowerCase()}). O que todo bolo leva fica na receita do produto.
        </p>
        <div className="space-y-2.5">
          <CostLines rows={rows} onChange={setRows} items={items} prefer="ingrediente" addLabel="Adicionar ingrediente" onNewItem={setNewRow} />
        </div>
        <Field
          label="Essa receita dá para quantos kg de bolo?"
          hint="Considere o bolo todo com esse sabor. Ex.: o recheio de brigadeiro recheia as 2 camadas de um bolo de 2 kg → 2. Para produtos por unidade, informe quantas unidades."
        >
          <div className="w-28">
            <Input inputMode="decimal" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} aria-label="Rende para quantos kg" />
          </div>
        </Field>
        <div className="rounded-xl bg-brand-soft px-3.5 py-3">
          <p className="num font-display text-xl font-bold text-brand-dark">
            {flavorCostLabel(rc.perUnit)}
            <span className="ml-1 text-sm font-medium">por kg</span>
          </p>
          <p className="num text-[12.5px] text-brand-dark/80">
            Receita {brl(rc.total)} ÷ {numInput(y)}. Bolo de 2 kg com esse sabor: {brl(rc.perUnit * 2)}.
          </p>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar custo do sabor"}
        </Button>
      </div>

      {newRow !== null && (
        <Sheet title="Novo ingrediente" onClose={() => setNewRow(null)}>
          <IngredientForm
            onDone={(saved) => {
              if (saved) {
                setAdded((a) => [...a, saved]);
                setRows((rs) => rs.map((r, j) => (j === newRow ? { ...r, ingredient_id: saved.id, unit: measureUnitFor(saved) } : r)));
              }
              setNewRow(null);
            }}
          />
        </Sheet>
      )}
    </Sheet>
  );
}
