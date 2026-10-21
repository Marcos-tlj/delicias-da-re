import type { MarginMode } from "./types";

/**
 * Preço de venda a partir do custo.
 * - markup ("sobre o custo"): preço = custo × (1 + %)
 * - margin ("sobre a venda"): o lucro vira % do preço final → preço = custo ÷ (1 − %)
 */
export function calcPrice(cost: number, pct: number, mode: MarginMode, rounding = 0) {
  const c = Math.max(0, Number(cost) || 0);
  const m = Math.max(0, Number(pct) || 0) / 100;
  let price = mode === "margin" ? c / (1 - Math.min(m, 0.95)) : c * (1 + m);
  if (rounding > 0) price = Math.ceil((price - 1e-9) / rounding) * rounding;
  return Math.round(price * 100) / 100;
}

/** Lucro por unidade, margem real (% do preço) e markup real (% do custo). */
export function profitOf(price: number, cost: number) {
  const profit = price - cost;
  return {
    profit,
    margin: price > 0 ? (profit / price) * 100 : 0,
    markup: cost > 0 ? (profit / cost) * 100 : 0,
  };
}

export const pctFmt = (v: number) => `${(Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
