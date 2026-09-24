import Link from "next/link";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { requireStaff } from "@/lib/supabase/server";
import { brl, formatDate } from "@/lib/format";
import { ButtonLink, Card, EmptyState, PageHeader, cn, inputClass } from "@/components/ui";

export const metadata = { title: "Clientes" };

type Row = {
  id: string;
  name: string;
  phone: string | null;
  neighborhood: string | null;
  orders: { total: number; status: string; due_at: string | null; created_at: string }[];
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const { supabase } = await requireStaff();

  let query = supabase
    .from("customers")
    .select("id, name, phone, neighborhood, orders(total, status, due_at, created_at)")
    .order("name")
    .limit(1000);
  if (q) {
    const digits = q.replace(/\D/g, "");
    query = digits.length >= 3 && digits.length === q.replace(/[\s()-]/g, "").length ? query.ilike("phone", `%${digits.slice(-4)}%`) : query.ilike("name", `%${q}%`);
  }
  const { data } = await query;
  const rows = ((data ?? []) as Row[]).map((c) => {
    const valid = c.orders.filter((o) => o.status !== "cancelado");
    const last = valid.map((o) => o.due_at ?? o.created_at).sort().at(-1) ?? null;
    return { ...c, count: valid.length, spent: valid.reduce((s, o) => s + Number(o.total), 0), last };
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${rows.length} cliente(s)`}
        actions={
          <ButtonLink href="/clientes/novo" variant="primary">
            <UserPlus className="h-4 w-4" /> Novo cliente
          </ButtonLink>
        }
      />

      <form className="relative mb-4 lg:w-80" action="/clientes">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" className={cn(inputClass, "pl-9")} />
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={q ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            text="Clientes também são cadastrados automaticamente ao criar um pedido."
          />
        ) : (
          <>
            <div className="hidden border-b border-line bg-bg/60 px-5 py-2 text-xs font-semibold text-ink-3 lg:grid lg:grid-cols-[1.6fr_1fr_1fr_0.7fr_1fr_20px] lg:gap-4">
              <span>Nome</span>
              <span>Telefone</span>
              <span>Bairro</span>
              <span className="text-right">Pedidos</span>
              <span className="text-right">Total gasto</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/clientes/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-bg/70 lg:grid lg:grid-cols-[1.6fr_1fr_1fr_0.7fr_1fr_20px] lg:gap-4 lg:px-5"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.name}</span>
                        <span className="block truncate text-xs text-ink-3 lg:hidden">
                          {[c.phone, `${c.count} pedido(s)`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </span>
                    <span className="hidden text-ink-2 lg:block">{c.phone ?? "—"}</span>
                    <span className="hidden truncate text-ink-2 lg:block">{c.neighborhood ?? "—"}</span>
                    <span className="num hidden text-right lg:block">{c.count}</span>
                    <span className="num text-right">
                      <span className="block font-semibold">{brl(c.spent)}</span>
                      {c.last && <span className="block text-xs text-ink-3 lg:hidden">últ. {formatDate(c.last)}</span>}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 text-ink-3 lg:block" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
