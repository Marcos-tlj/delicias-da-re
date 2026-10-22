"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Search, Wheat } from "lucide-react";
import type { Ingredient, IngredientKind } from "@/lib/types";
import { INGREDIENT_KINDS } from "@/lib/types";
import { brl, formatDate } from "@/lib/format";
import { qtyLabel, refPrice } from "@/lib/ingredients";
import { Button, Card, EmptyState, Input, cn } from "@/components/ui";
import IngredientForm from "@/components/IngredientForm";
import Sheet from "@/components/Sheet";

export default function IngredientsList({ ingredients, usage }: { ingredients: Ingredient[]; usage: Record<string, string[]> }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<IngredientKind | "todos">("todos");
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const list = ingredients.filter((i) => (tab === "todos" || i.kind === tab) && (!q || norm(i.name).includes(norm(q))));
  const count = (k: IngredientKind) => ingredients.filter((i) => i.kind === k).length;

  return (
    <>
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-9" aria-label="Buscar" />
        </div>
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> <span className="hidden sm:inline">Novo item</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {[{ id: "todos" as const, plural: "Todos", n: ingredients.length }, ...INGREDIENT_KINDS.map((k) => ({ id: k.id, plural: k.plural, n: count(k.id) }))].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition", tab === t.id ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5")}
          >
            {t.plural} · {t.n}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wheat className="h-5 w-5" />}
            title={q ? "Nada encontrado" : "Nada cadastrado aqui ainda"}
            text={q ? undefined : "Ex.: Leite condensado · 395 g · R$ 7,49, ou Caixinha · 50 un · R$ 30. O sistema calcula quanto custa cada grama ou unidade."}
            action={
              !q && (
                <Button variant="primary" onClick={() => setEditing("new")}>
                  <Plus className="h-4 w-4" /> Cadastrar o primeiro
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((i) => {
            const ref = refPrice(i);
            const used = usage[i.id] ?? [];
            return (
              <button key={i.id} onClick={() => setEditing(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg/70 lg:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {i.name}
                    {i.kind !== "ingrediente" && tab === "todos" && <span className="ml-1.5 rounded-md bg-bg px-1.5 py-0.5 align-middle text-[10.5px] font-bold text-ink-3 uppercase">{i.kind}</span>}
                  </p>
                  <p className="num truncate text-xs text-ink-3">
                    {qtyLabel(i.package_qty, i.unit)} por {brl(i.package_price)}
                    {used.length > 0 && ` · em ${used.length} produto${used.length > 1 ? "s" : ""}`}
                    {i.updated_at && ` · atualizado ${formatDate(i.updated_at)}`}
                  </p>
                </div>
                <div className="num shrink-0 text-right">
                  <p className="text-[14px] font-bold">{brl(ref.value)}</p>
                  <p className="text-[11px] text-ink-3">por {ref.label}</p>
                </div>
              </button>
            );
          })}
        </Card>
      )}

      {editing && (
        <Sheet title={editing === "new" ? "Novo item" : "Editar item"} onClose={() => setEditing(null)}>
          <IngredientForm
            key={editing === "new" ? "new" : editing.id}
            ingredient={editing === "new" ? undefined : editing}
            usedIn={editing === "new" ? [] : (usage[editing.id] ?? [])}
            initialName={editing === "new" ? q : ""}
            initialKind={tab === "todos" ? "ingrediente" : tab}
            onDone={(_, info) => {
              setEditing(null);
              if (info?.updated) setToast(`Custo atualizado em ${info.updated} produto${info.updated > 1 ? "s" : ""}.`);
            }}
          />
        </Sheet>
      )}

      {toast && (
        <div className="animate-fade-in fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[13.5px] font-medium text-white shadow-[var(--shadow-pop)] lg:bottom-8">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> {toast}
        </div>
      )}
    </>
  );
}
