import { requireStaff } from "@/lib/supabase/server";
import { normalizeIngredient, normalizeRecipe } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import IngredientsList from "./IngredientsList";

export const metadata = { title: "Ingredientes e embalagens" };

export default async function IngredientsPage() {
  const { supabase } = await requireStaff();
  const [{ data: ings }, { data: products }, { data: flavors }] = await Promise.all([
    supabase.from("ingredients").select("*").order("name"),
    supabase.from("products").select("id, name, recipe, packaging").order("name"),
    supabase.from("option_items").select("name, recipe"),
  ]);

  const usage: Record<string, string[]> = {};
  for (const p of products ?? []) {
    for (const l of [...normalizeRecipe(p.recipe), ...normalizeRecipe(p.packaging)]) {
      const list = (usage[l.ingredient_id] ??= []);
      if (!list.includes(p.name as string)) list.push(p.name as string);
    }
  }

  for (const f of flavors ?? []) {
    for (const l of normalizeRecipe(f.recipe)) {
      const list = (usage[l.ingredient_id] ??= []);
      const label = `sabor ${f.name}`;
      if (!list.includes(label)) list.push(label);
    }
  }

  return (
    <>
      <PageHeader
        title="Ingredientes e embalagens"
        subtitle="Cadastre o que comprou, quanto veio e quanto pagou. Depois é só dizer, em cada produto, quanto usou."
      />
      <IngredientsList ingredients={(ings ?? []).map(normalizeIngredient)} usage={usage} />
    </>
  );
}
