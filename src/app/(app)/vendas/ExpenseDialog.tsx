"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet, X } from "lucide-react";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { brl, numInput, parseNum } from "@/lib/format";
import { deleteExpense, saveExpense } from "../actions";
import { Button, ErrorNote, Field, Input, Select } from "@/components/ui";

const todaySP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fechar" />
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-sheet pb-safe relative w-full max-w-md rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-bg" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExpenseForm({ expense, onDone }: { expense?: Expense; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? numInput(expense.amount) : "");
  const [date, setDate] = useState(expense?.spent_on ?? todaySP());
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "embalagem");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await saveExpense({ id: expense?.id, description, amount: parseNum(amount), spent_on: date, category });
      if (r.error) return setError(r.error);
      onDone();
      router.refresh();
    });
  };
  const remove = () => {
    if (!expense || !window.confirm(`Excluir a despesa "${expense.description}"?`)) return;
    start(async () => {
      const r = await deleteExpense(expense.id);
      if (r.error) return setError(r.error);
      onDone();
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <p className="text-[13px] text-ink-3">Gastos que não estão no custo de cada produto: gás, energia, embalagens em lote, entregas, divulgação.</p>
      <Field label="Descrição">
        <Input autoFocus required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Caixas para bolo" maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)">
          <Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Data">
          <Input type="date" value={date} max={todaySP()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Categoria">
        <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2 pt-1">
        <Button variant="primary" size="lg" className="flex-1" disabled={pending}>
          {pending ? "Salvando…" : expense ? "Salvar despesa" : "Lançar despesa"}
        </Button>
        {expense && (
          <Button type="button" variant="danger" size="lg" onClick={remove} disabled={pending} aria-label="Excluir despesa">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

export default function ExpenseDialog({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Lançar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Wallet className="h-4 w-4" /> Lançar despesa
        </Button>
      )}
      {open && (
        <Sheet title="Nova despesa" onClose={() => setOpen(false)}>
          <ExpenseForm onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}

export function ExpenseRow({ expense: e, label }: { expense: Expense; label: string }) {
  const [open, setOpen] = useState(false);
  const d = e.spent_on;
  return (
    <li>
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg/70 lg:px-5">
        <span className="num w-11 shrink-0 rounded-lg bg-bg py-1 text-center text-xs font-bold text-ink-2">
          {d.slice(8, 10)}/{d.slice(5, 7)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{e.description}</p>
          <p className="text-xs text-ink-3">{label}</p>
        </div>
        <span className="num shrink-0 text-[13.5px] font-bold text-red-700">−{brl(e.amount)}</span>
      </button>
      {open && (
        <Sheet title="Editar despesa" onClose={() => setOpen(false)}>
          <ExpenseForm expense={e} onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </li>
  );
}
