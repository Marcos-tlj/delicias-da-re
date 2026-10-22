"use client";

import { X } from "lucide-react";
import type { Ingredient, IngredientKind, IngredientUnit } from "@/lib/types";
import { INGREDIENT_KINDS } from "@/lib/types";
import { brl, parseNum } from "@/lib/format";
import { compatibleUnits, lineCost, unitInfo } from "@/lib/ingredients";
import { Input, Select } from "@/components/ui";

export type CostRow = { ingredient_id: string; qty: string; unit: IngredientUnit };
export const NEW_ITEM = "__novo__";

/** Unidade sugerida para medir: g para quem compra em kg, ml para quem compra em L. */
export const measureUnitFor = (ing?: Ingredient): IngredientUnit => (ing ? (unitInfo(ing.unit).base as IngredientUnit) : "g");

/**
 * Linhas "item cadastrado + quantidade usada + medida + custo".
 * Usado na receita (ingredientes) e nas embalagens por unidade.
 */
export default function CostLines({
  rows,
  onChange,
  items,
  prefer,
  addLabel,
  onNewItem,
}: {
  rows: CostRow[];
  onChange: (rows: CostRow[]) => void;
  items: Map<string, Ingredient>;
  /** tipo que aparece primeiro na lista */
  prefer: IngredientKind;
  addLabel: string;
  /** pede para cadastrar um item novo para a linha `i` */
  onNewItem: (i: number) => void;
}) {
  const update = (i: number, patch: Partial<CostRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const sorted = [...items.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const kinds = [...INGREDIENT_KINDS].sort((a, b) => (a.id === prefer ? -1 : b.id === prefer ? 1 : 0));

  return (
    <>
      {rows.map((r, i) => {
        const ing = items.get(r.ingredient_id);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg/40 p-2 sm:flex-nowrap sm:border-0 sm:bg-transparent sm:p-0">
            <Select
              value={r.ingredient_id}
              onChange={(e) => {
                const id = e.target.value;
                if (id === NEW_ITEM) return onNewItem(i);
                update(i, { ingredient_id: id, unit: measureUnitFor(items.get(id)) });
              }}
              className="w-full min-w-0 sm:w-auto sm:flex-1"
              aria-label="Item"
            >
              <option value="" disabled>
                Escolha…
              </option>
              {kinds.map((k) => {
                const opts = sorted.filter((x) => x.kind === k.id);
                return opts.length ? (
                  <optgroup key={k.id} label={k.plural}>
                    {opts.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
              <option value={NEW_ITEM}>+ Cadastrar novo</option>
            </Select>
            <div className="min-w-0 flex-1 sm:w-24 sm:flex-none">
              <Input inputMode="decimal" value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} placeholder="Qtd." aria-label="Quantidade usada" />
            </div>
            <Select value={r.unit} onChange={(e) => update(i, { unit: e.target.value as IngredientUnit })} className="w-[76px] shrink-0" aria-label="Medida">
              {compatibleUnits(ing ? ing.unit : r.unit).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
            <span className="num w-[76px] shrink-0 text-right text-[13px] font-semibold text-ink-2">{ing ? brl(lineCost(ing, parseNum(r.qty), r.unit)) : "—"}</span>
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-ink-3 hover:bg-red-50 hover:text-red-600" aria-label="Remover">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, { ingredient_id: "", qty: "", unit: prefer === "ingrediente" ? "g" : "un" }])}
        className="text-[13px] font-semibold text-brand hover:text-brand-dark"
      >
        + {addLabel}
      </button>
    </>
  );
}

export const toLines = (rows: CostRow[]) =>
  rows.filter((r) => r.ingredient_id && parseNum(r.qty) > 0).map((r) => ({ ingredient_id: r.ingredient_id, qty: parseNum(r.qty), unit: r.unit }));
