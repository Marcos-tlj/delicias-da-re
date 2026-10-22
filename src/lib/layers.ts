import type { OptionGroup, OptionList, SelectedOptions } from "./types";

export const MAX_LAYERS = 8;

export const isLayers = (g: OptionGroup) => g.kind === "layers";

/** Listas que alimentam a escolha (camadas usam várias listas). */
export const groupListIds = (g: OptionGroup) => (isLayers(g) && g.list_ids?.length ? g.list_ids : g.list_id ? [g.list_id] : []);

export const layerCount = (g: OptionGroup) => Math.min(MAX_LAYERS, Math.max(1, Math.round(Number(g.layers) || 2)));

/** Nome salvo no pedido para cada camada: "Recheio (camada 1)". */
export const layerKey = (label: string, i: number) => `${label} (camada ${i + 1})`;

/** Lê as camadas já escolhidas de um item de pedido (para editar). */
export function readLayers(label: string, options: SelectedOptions) {
  const out: string[] = [];
  for (let i = 0; i < MAX_LAYERS; i++) {
    const v = options[layerKey(label, i)];
    if (v === undefined) break;
    out.push(Array.isArray(v) ? (v[0] ?? "") : v);
  }
  return out;
}

/** Em qual lista está o sabor (a primeira, se o nome aparece em mais de uma). */
export function listOfChoice(name: string, listIds: string[], lists: OptionList[]) {
  for (const id of listIds) {
    const l = lists.find((x) => x.id === id);
    if (l?.option_items?.some((i) => i.name === name)) return l;
  }
  return undefined;
}

/**
 * Preço do kg pelas camadas: média do preço da lista de cada camada.
 * Ex.: 1 tradicional (R$ 65) + 1 especial (R$ 80) = R$ 72,50 o kg.
 * Camada sem sabor ou lista sem preço usa o preço do produto.
 * Devolve null se o produto não tem camadas.
 */
export function layeredPrice(groups: OptionGroup[], options: SelectedOptions, lists: OptionList[], basePrice: number) {
  const g = groups.find(isLayers);
  if (!g) return null;
  const ids = groupListIds(g);
  const chosen = readLayers(g.label, options);
  if (!chosen.length) return null;
  const prices = chosen.map((name) => {
    const l = name ? listOfChoice(name, ids, lists) : undefined;
    const p = l?.price_per_kg;
    return p !== null && p !== undefined && Number(p) > 0 ? Number(p) : basePrice;
  });
  return Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
}
