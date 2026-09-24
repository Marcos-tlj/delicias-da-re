import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import type { Product } from "@/lib/types";
import ProductForm from "./ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  if (id === "novo") return <ProductForm product={null} />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <ProductForm product={data as Product} />;
}
