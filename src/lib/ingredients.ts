import type { Ingredient, IngredientUnit, RecipeLine } from "./types";

/**
 * Unidades de compra/uso. Tudo é convertido para a unidade base
 * (g para peso, ml para volume, un para unidade) antes de calcular.
 */
export const UNITS: { id: IngredientUnit; label: string; base: "g" | "ml" | "un"; factor: number }[] = [
  { id: "g", label: "g", base: "g", factor: 1 },
  { id: "kg", label: "kg", base: "g", factor: 1000 },
  { id: "ml", label: "ml", base: "ml", factor: 1 },
  { id: "l", label: "L", base: "ml", factor: 1000 },
  { id: "un", label: "un", base: "un", factor: 1 },
];

export const unitInfo = (u: string) => UNITS.find((x) => x.id === u) ?? UNITS[0];
export const isUnit = (u: unknown): u is IngredientUnit => UNITS.some((x) => x.id === u);

/** Unidades em que dá para medir um ingrediente comprado em `u` (peso com peso, volume com volume). */
export const compatibleUnits = (u: string) => UNITS.filter((x) => x.base === unitInfo(u).base);

/** Preço de 1 unidade base (R$ por g, ml ou un). */
export function costPerBase(ing: Pick<Ingredient, "unit" | "package_qty" | "package_price">) {
  const qty = Number(ing.package_qty) * unitInfo(ing.unit).factor;
  return qty > 0 ? Number(ing.package_price) / qty : 0;
}

/** Custo de usar `qty` `unit` deste ingrediente. Unidades incompatíveis contam como zero. */
export function lineCost(ing: Pick<Ingredient, "unit" | "package_qty" | "package_price">, qty: number, unit: string) {
  const u = unitInfo(unit);
  if (u.base !== unitInfo(ing.unit).base) return 0;
  return Math.max(0, Number(qty) || 0) * u.factor * costPerBase(ing);
}

/** Preço de referência legível: R$/kg, R$/L ou R$/un. */
export function refPrice(ing: Pick<Ingredient, "unit" | "package_qty" | "package_price">) {
  const base = unitInfo(ing.unit).base;
  const per = base === "un" ? 1 : 1000;
  return { value: costPerBase(ing) * per, label: base === "g" ? "kg" : base === "ml" ? "L" : "un" };
}

export function qtyLabel(qty: number, unit: string) {
  return `${Number(qty).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unitInfo(unit).label}`;
}

/**
 * Custo da receita.
 * - total: soma de todos os ingredientes usados
 * - perUnit: total ÷ rendimento (custo de 1 unidade ou 1 kg do produto)
 */
export function recipeCost(recipe: RecipeLine[], ingredients: Map<string, Ingredient> | Ingredient[], yieldQty: number) {
  const map = Array.isArray(ingredients) ? new Map(ingredients.map((i) => [i.id, i] as const)) : ingredients;
  let total = 0;
  const lines = recipe.map((l) => {
    const ing = map.get(l.ingredient_id);
    const cost = ing ? lineCost(ing, l.qty, l.unit) : 0;
    total += cost;
    return { ...l, cost, missing: !ing };
  });
  const y = Number(yieldQty) > 0 ? Number(yieldQty) : 1;
  return { lines, total, perUnit: total / y };
}

/** Custo de itens usados por unidade vendida (embalagens etc.): soma direta, sem dividir pelo rendimento. */
export function linesCost(lines: RecipeLine[], ingredients: Map<string, Ingredient> | Ingredient[]) {
  return recipeCost(lines, ingredients, 1).total;
}

/** Custo final por unidade: receita ÷ rendimento + embalagens + outros custos digitados (gás, mão de obra…). */
export function productCost(recipePerUnit: number, packagingCost: number, extras: { value: number }[]) {
  return recipePerUnit + packagingCost + extras.reduce((a, c) => a + (Number(c.value) || 0), 0);
}
