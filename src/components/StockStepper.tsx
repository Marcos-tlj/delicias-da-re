"use client";

import { useEffect, useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import type { Unit } from "@/lib/types";
import { adjustStock } from "@/app/(app)/actions";
import { cn } from "./ui";

export default function StockStepper({ id, value, unit, size = "sm" }: { id: string; value: number; unit: Unit; size?: "sm" | "md" }) {
  const [local, setLocal] = useState(value);
  const [pending, start] = useTransition();
  useEffect(() => setLocal(value), [value]);

  const step = unit === "kg" ? 0.5 : 1;
  const change = (d: number) => {
    const next = Math.max(0, Math.round((local + d) * 100) / 100);
    if (next === local) return;
    setLocal(next);
    start(async () => {
      const r = await adjustStock(id, d);
      if (r.error) setLocal(value);
    });
  };

  const btn = cn(
    "flex items-center justify-center text-ink-2 transition hover:bg-bg hover:text-ink disabled:opacity-30",
    size === "md" ? "h-10 w-10" : "h-8 w-8",
  );

  return (
    <div className={cn("inline-flex shrink-0 items-center rounded-xl border border-line bg-surface", pending && "opacity-70")}>
      <button type="button" className={cn(btn, "rounded-l-xl")} onClick={() => change(-step)} disabled={local <= 0} aria-label="Diminuir estoque">
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <span className={cn("num min-w-9 text-center font-bold", size === "md" ? "text-base" : "text-sm", local === 0 && "text-red-600")}>
        {local.toLocaleString("pt-BR")}
      </span>
      <button type="button" className={cn(btn, "rounded-r-xl")} onClick={() => change(step)} aria-label="Aumentar estoque">
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
