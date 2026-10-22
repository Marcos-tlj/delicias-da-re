import { requireStaff } from "@/lib/supabase/server";
import { normalizeProduct } from "@/lib/queries";
import type { OptionList } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { groupListIds } from "@/lib/layers";
import OptionListsEditor from "./OptionListsEditor";

export const metadata = { title: "Sabores e opções" };

export default async function FlavorsPage() {
  const { supabase } = await requireStaff();
  const [{ data: lists }, { data: products }] = await Promise.all([
    supabase.from("option_lists").select("*, option_items(*)").order("sort_order").order("name"),
    supabase.from("products").select("*"),
  ]);

  const usage: Record<string, string[]> = {};
  for (const p of (products ?? []).map(normalizeProduct)) {
    for (const g of p.option_groups)
      for (const id of groupListIds(g)) if (!(usage[id] ??= []).includes(p.name)) usage[id].push(p.name);
  }

  return (
    <>
      <PageHeader
        title="Sabores e opções"
        subtitle="Massas, recheios, coberturas e adicionais. Um item novo aparece na hora em todos os produtos que usam a lista."
      />
      <OptionListsEditor lists={(lists ?? []) as OptionList[]} usage={usage} />
    </>
  );
}
