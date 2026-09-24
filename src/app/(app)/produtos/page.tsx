import Link from "next/link";
import { Cake, Plus } from "lucide-react";
import { requireStaff } from "@/lib/supabase/server";
import { normalizeProduct } from "@/lib/queries";
import { CATEGORIES } from "@/lib/types";
import { ButtonLink, Card, EmptyState, PageHeader, cn } from "@/components/ui";
import ProductRow from "./ProductRow";

export const metadata = { title: "Produtos e estoque" };

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "estoque", label: "Prontos (com estoque)" },
  { id: "inativos", label: "Pausados" },
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const filtro = (await searchParams).filtro ?? "todos";
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("products").select("*").order("sort_order").order("name");
  let products = (data ?? []).map(normalizeProduct);
  if (filtro === "estoque") products = products.filter((p) => p.stock_enabled);
  if (filtro === "inativos") products = products.filter((p) => !p.is_active);

  return (
    <>
      <PageHeader
        title="Produtos e estoque"
        subtitle="Preços, disponibilidade e bolos prontos"
        actions={
          <ButtonLink href="/produtos/novo" variant="primary">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo produto
          </ButtonLink>
        }
      />

      <div className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/produtos?filtro=${f.id}`}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition",
              filtro === f.id ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <Card>
          <EmptyState icon={<Cake className="h-5 w-5" />} title="Nenhum produto aqui" />
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((c) => {
            const list = products.filter((p) => p.category === c.id);
            if (!list.length) return null;
            return (
              <section key={c.id}>
                <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-ink-3 uppercase">
                  {c.label} · {list.length}
                </h2>
                <Card className="divide-y divide-line overflow-hidden">
                  {list.map((p) => (
                    <ProductRow key={p.id} product={p} />
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
