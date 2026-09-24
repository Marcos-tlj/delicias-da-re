import { notFound } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { requireStaff } from "@/lib/supabase/server";
import type { Customer, Order } from "@/lib/types";
import { brl, formatDate } from "@/lib/format";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import OrderCard from "@/components/OrderCard";
import CustomerForm from "./CustomerForm";

export const metadata = { title: "Cliente" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  if (id === "novo") {
    return (
      <>
        <PageHeader title="Novo cliente" back={{ href: "/clientes", label: "Clientes" }} />
        <div className="max-w-2xl">
          <CustomerForm customer={null} />
        </div>
      </>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("orders")
      .select("*, order_items(product_name, quantity, unit)")
      .eq("customer_id", id)
      .order("due_at", { ascending: false, nullsFirst: false })
      .limit(200),
  ]);
  if (!customer) notFound();
  const c = customer as Customer;
  const list = (orders ?? []) as Order[];
  const valid = list.filter((o) => o.status !== "cancelado");
  const spent = valid.reduce((s, o) => s + Number(o.total), 0);
  const owed = valid.reduce((s, o) => s + Math.max(0, Number(o.total) - Number(o.amount_paid)), 0);

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`Cliente desde ${formatDate(c.created_at, { month: "long", year: "numeric" })}`}
        back={{ href: "/clientes", label: "Clientes" }}
        actions={
          <ButtonLink href={`/pedidos/novo?cliente=${c.id}`} variant="primary">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo pedido
          </ButtonLink>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: "Pedidos", value: String(valid.length) },
          { label: "Total gasto", value: brl(spent) },
          { label: "Em aberto", value: brl(owed), red: owed > 0 },
        ].map((s) => (
          <Card key={s.label} className="p-3.5 lg:p-5">
            <p className="text-xs font-semibold text-ink-3 lg:text-[13px]">{s.label}</p>
            <p className={`num mt-1 text-base font-bold lg:text-xl ${s.red ? "text-red-600" : ""}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:gap-6">
        <Card className="overflow-hidden">
          <CardHeader title="Histórico de pedidos" />
          {list.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nenhum pedido ainda" />
          ) : (
            <div className="divide-y divide-line">
              {list.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
          )}
        </Card>
        <div>
          <CustomerForm customer={c} />
        </div>
      </div>
    </>
  );
}
