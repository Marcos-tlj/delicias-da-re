import { requireStaff } from "@/lib/supabase/server";
import { normalizeIngredient, normalizeRecipe } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import IngredientsList from "./IngredientsList";

export const metadata = { title: "Ingredientes" };

export default async function IngredientsPage() {
  const { supabase } = await requireStaff();
  const [{ data: ings }, { data: products }] = await Promise.all([
    supabase.from("ingredients").select("*").order("name"),
    supabase.from("products").select("id, name, recipe").order("name"),
  ]);

  const usage: Record<string, string[]> = {};
  for (const p of products ?? []) {
    for (const l of normalizeRecipe(p.recipe)) {
      const list = (usage[l.ingredient_id] ??= []);
      if (!list.includes(p.name as string)) list.push(p.name as string);
    }
  }

  return (
    <>
      <PageHeader
        title="Ingredientes"
        subtitle="Cadastre o que comprou, quanto veio e quanto pagou. Depois é só dizer, na receita de cada produto, quanto usou."
      />
      <IngredientsList ingredients={(ings ?? []).map(normalizeIngredient)} usage={usage} />
    </>
  );
}
