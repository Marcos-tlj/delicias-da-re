import { requireStaff } from "@/lib/supabase/server";
import { normalizeIngredient, normalizeProduct } from "@/lib/queries";
import type { OptionList } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { groupListIds, isLayers } from "@/lib/layers";
import OptionListsEditor from "./OptionListsEditor";

export const metadata = { title: "Sabores e opções" };

export default async function FlavorsPage() {
  const { supabase } = await requireStaff();
  const [{ data: lists }, { data: products }, { data: ings }] = await Promise.all([
    supabase.from("option_lists").select("*, option_items(*)").order("sort_order").order("name"),
    supabase.from("products").select("*"),
    supabase.from("ingredients").select("*").order("name"),
  ]);

  const usage: Record<string, string[]> = {};
  const layered: string[] = []; // listas usadas em camadas de recheio (têm preço do kg)
  for (const p of (products ?? []).map(normalizeProduct)) {
    for (const g of p.option_groups)
      for (const id of groupListIds(g)) {
        if (!(usage[id] ??= []).includes(p.name)) usage[id].push(p.name);
        if (isLayers(g) && !layered.includes(id)) layered.push(id);
      }
  }

  return (
    <>
      <PageHeader
        title="Sabores e opções"
        subtitle="Massas, recheios, coberturas e adicionais. Um item novo aparece na hora em todos os produtos que usam a lista. Toque no valor ao lado de cada sabor para montar o custo dele por kg."
      />
      <OptionListsEditor lists={(lists ?? []) as OptionList[]} usage={usage} layered={layered} ingredients={(ings ?? []).map(normalizeIngredient)} />
    </>
  );
}
