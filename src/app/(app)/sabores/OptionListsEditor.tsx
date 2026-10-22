"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import type { OptionList } from "@/lib/types";
import {
  addOptionItem,
  createOptionList,
  deleteOptionItem,
  deleteOptionList,
  renameOptionList,
  setListPrice,
  setOptionItemActive,
} from "../actions";
import { brl, numInput, parseNum } from "@/lib/format";
import { Button, Card, ErrorNote, Input, cn } from "@/components/ui";

export default function OptionListsEditor({ lists, usage }: { lists: OptionList[]; usage: Record<string, string[]> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newList, setNewList] = useState("");
  const [error, setError] = useState("");

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="space-y-5">
      <ErrorNote>{error}</ErrorNote>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lists.map((l) => (
          <ListCard key={l.id} list={l} usedBy={usage[l.id] ?? []} run={run} pending={pending} />
        ))}

        <Card className="flex flex-col justify-center border-dashed p-4 lg:p-5">
          <p className="font-semibold">Nova lista</p>
          <p className="mb-3 text-[13px] text-ink-3">Ex.: “Recheios de torta”, “Tamanhos”, “Decorações”.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => createOptionList(newList), () => setNewList(""));
            }}
          >
            <Input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="Nome da lista" />
            <Button variant="dark" disabled={pending || !newList.trim()} aria-label="Criar lista">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function ListCard({
  list,
  usedBy,
  run,
  pending,
}: {
  list: OptionList;
  usedBy: string[];
  run: (fn: () => Promise<{ error?: string }>, after?: () => void) => void;
  pending: boolean;
}) {
  const [item, setItem] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const savedPrice = list.price_per_kg ? Number(list.price_per_kg) : 0;
  const [price, setPrice] = useState(savedPrice ? numInput(savedPrice) : "");
  const savePrice = () => {
    const v = parseNum(price);
    if (v === savedPrice) return;
    run(() => setListPrice(list.id, v > 0 ? v : null));
  };
  const items = [...(list.option_items ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        {editing ? (
          <form
            className="flex flex-1 gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameOptionList(list.id, name), () => setEditing(false));
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" autoFocus />
            <Button size="sm" variant="dark" className="h-9" aria-label="Salvar nome">
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setEditing(false)} aria-label="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <>
            <div className="min-w-0">
              <p className="font-semibold">{list.name}</p>
              <p className="truncate text-xs text-ink-3">{usedBy.length ? `Usada em: ${usedBy.join(", ")}` : "Não usada em produtos"}</p>
            </div>
            <div className="flex shrink-0">
              <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-ink-3 hover:bg-bg hover:text-ink" aria-label="Renomear lista">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() =>
                  window.confirm(
                    usedBy.length
                      ? `A lista "${list.name}" é usada em ${usedBy.length} produto(s). Excluir mesmo assim? Esses produtos ficarão sem essa escolha.`
                      : `Excluir a lista "${list.name}"?`,
                  ) && run(() => deleteOptionList(list.id))
                }
                className="rounded-lg p-1.5 text-ink-3 hover:bg-red-50 hover:text-red-600"
                aria-label="Excluir lista"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-b border-line bg-bg/40 px-4 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          savePrice();
        }}
      >
        <label htmlFor={`price-${list.id}`} className="flex-1 text-[12.5px] text-ink-3">
          Preço do kg do bolo com recheio desta lista
          {savedPrice > 0 && <span className="num block font-semibold text-ink-2">{brl(savedPrice)}/kg · usado nas camadas de recheio</span>}
        </label>
        <input
          id={`price-${list.id}`}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={savePrice}
          placeholder="—"
          className="num h-8 w-20 rounded-lg border border-line bg-surface px-2 text-right text-[13px] outline-none focus:border-ink-2"
          aria-label="Preço do kg"
        />
      </form>

      <ul className="flex-1 divide-y divide-line">
        {items.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-3">Nenhum item ainda.</li>}
        {items.map((i) => (
          <li key={i.id} className="group flex items-center gap-2 px-4 py-2">
            <span className={cn("flex-1 text-[13.5px]", !i.is_active && "text-ink-3 line-through")}>{i.name}</span>
            <button
              onClick={() => run(() => setOptionItemActive(i.id, !i.is_active))}
              className="rounded-md p-1 text-ink-3 hover:bg-bg hover:text-ink"
              title={i.is_active ? "Esconder (em falta)" : "Mostrar de novo"}
              aria-label={i.is_active ? "Esconder" : "Mostrar"}
            >
              {i.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button
              onClick={() => window.confirm(`Excluir "${i.name}"?`) && run(() => deleteOptionItem(i.id))}
              className="rounded-md p-1 text-ink-3 hover:bg-red-50 hover:text-red-600"
              aria-label="Excluir item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <form
        className="flex gap-2 border-t border-line bg-bg/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addOptionItem(list.id, item), () => setItem(""));
        }}
      >
        <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Adicionar item…" className="h-9 bg-surface" />
        <Button size="sm" variant="dark" className="h-9" disabled={pending || !item.trim()} aria-label="Adicionar item">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
