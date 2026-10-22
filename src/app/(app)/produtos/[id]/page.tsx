import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { normalizeIngredient, normalizeProduct } from "@/lib/queries";
import type { OptionList } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import ProductForm from "./ProductForm";

export const metadata = { title: "Produto" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [{ data: lists }, { data: ings }] = await Promise.all([
    supabase.from("option_lists").select("id, name, sort_order").order("sort_order").order("name"),
    supabase.from("ingredients").select("*").order("name"),
  ]);
  const ingredients = (ings ?? []).map(normalizeIngredient);

  if (id === "novo") {
    return (
      <>
        <PageHeader title="Novo produto" back={{ href: "/produtos", label: "Produtos" }} />
        <ProductForm product={null} lists={(lists ?? []) as OptionList[]} ingredients={ingredients} />
      </>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const product = normalizeProduct(data);
  return (
    <>
      <PageHeader title={product.name} back={{ href: "/produtos", label: "Produtos" }} />
      <ProductForm product={product} lists={(lists ?? []) as OptionList[]} ingredients={ingredients} />
    </>
  );
}
