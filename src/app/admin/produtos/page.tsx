import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import type { Product } from "@/lib/types";
import ProductsAdmin from "./ProductsAdmin";

export default async function AdminProductsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("products").select("*").order("category").order("sort_order").order("name");

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="text-sm text-cocoa-light">Toque no botão para pausar/ativar. Toque no produto para editar.</p>
      </div>
      <ProductsAdmin products={(data ?? []) as Product[]} />
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 px-4 pt-2">
        <Link
          href="/admin/produtos/novo"
          className="mx-auto block max-w-md rounded-2xl bg-berry py-4 text-center font-bold text-white shadow-lg"
        >
          + Novo produto
        </Link>
      </div>
    </div>
  );
}
