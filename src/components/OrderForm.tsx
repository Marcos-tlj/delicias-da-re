"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin, Pencil, Plus, Search, Store, Trash2, UserPlus, X } from "lucide-react";
import type { Customer, OptionList, Order, OrderStatus, PaymentMethod, Product, SelectedOptions, Unit } from "@/lib/types";
import { PAYMENT_METHODS, STATUSES } from "@/lib/types";
import { brl, fromLocalInput, maskPhone, numInput, optionsText, parseNum, qty, toLocalInput } from "@/lib/format";
import { saveOrder } from "@/app/(app)/actions";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Segmented, Select, Textarea, cn } from "./ui";
import ItemDialog, { type DraftItem } from "./ItemDialog";

type CustomerLite = Pick<Customer, "id" | "name" | "phone" | "address" | "neighborhood">;

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export default function OrderForm({
  products,
  lists,
  customers,
  initial,
  presetCustomerId,
}: {
  products: Product[];
  lists: OptionList[];
  customers: CustomerLite[];
  initial: Order | null;
  presetCustomerId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const preset = customers.find((c) => c.id === (initial?.customer_id ?? presetCustomerId)) ?? null;

  // ---------- cliente ----------
  const [customer, setCustomer] = useState<CustomerLite | null>(preset);
  const [newCustomer, setNewCustomer] = useState(!preset && !!initial);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState(preset ? "" : (initial?.customer_name ?? ""));
  const [phone, setPhone] = useState(maskPhone(initial?.customer_phone ?? preset?.phone ?? ""));

  // ---------- itens ----------
  const [items, setItems] = useState<DraftItem[]>(
    (initial?.order_items ?? []).map((i) => ({
      key: newKey(),
      product_id: i.product_id,
      product_name: i.product_name,
      unit: i.unit as Unit,
      unit_price: Number(i.unit_price),
      quantity: Number(i.quantity),
      options: (i.options ?? {}) as SelectedOptions,
      note: i.note ?? "",
    })),
  );
  const [dialog, setDialog] = useState<{ open: boolean; editing: DraftItem | null }>({ open: false, editing: null });

  // ---------- entrega / pagamento ----------
  const [deliveryType, setDeliveryType] = useState<"retirada" | "entrega">(initial?.delivery_type ?? "retirada");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [due, setDue] = useState(toLocalInput(initial?.due_at));
  const [fee, setFee] = useState(initial ? numInput(initial.delivery_fee) : "");
  const [discount, setDiscount] = useState(initial ? numInput(initial.discount) : "");
  const [method, setMethod] = useState<PaymentMethod | "">(initial?.payment_method ?? "");
  const [paid, setPaid] = useState(initial ? numInput(initial.amount_paid) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<OrderStatus>("confirmado");

  const subtotal = items.reduce((s, i) => s + Math.round(i.unit_price * i.quantity * 100) / 100, 0);
  const total = Math.max(0, subtotal + parseNum(fee) - parseNum(discount));
  const remaining = Math.max(0, total - parseNum(paid));

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)))
      .slice(0, 8);
  }, [search, customers]);

  const pickCustomer = (c: CustomerLite) => {
    setCustomer(c);
    setSearch("");
    setPhone(maskPhone(c.phone ?? ""));
    if (!address && (c.address || c.neighborhood)) setAddress([c.address, c.neighborhood].filter(Boolean).join(" — "));
  };

  const upsertItem = (it: DraftItem) => {
    setItems((prev) => (prev.some((p) => p.key === it.key) ? prev.map((p) => (p.key === it.key ? it : p)) : [...prev, it]));
    setDialog({ open: false, editing: null });
  };

  const submit = () => {
    setError("");
    const name = customer ? customer.name : newName.trim();
    if (!name) return setError("Escolha um cliente ou cadastre um novo.");
    if (items.length === 0) return setError("Adicione pelo menos um item.");
    start(async () => {
      const r = await saveOrder({
        id: initial?.id,
        customer_id: customer?.id ?? null,
        customer_name: name,
        customer_phone: phone,
        delivery_type: deliveryType,
        address: deliveryType === "entrega" ? address : "",
        due_at: fromLocalInput(due),
        payment_method: method,
        amount_paid: parseNum(paid),
        delivery_fee: deliveryType === "entrega" ? parseNum(fee) : 0,
        discount: parseNum(discount),
        notes,
        status: initial ? undefined : status,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          unit: i.unit,
          unit_price: i.unit_price,
          quantity: i.quantity,
          options: i.options,
          note: i.note.trim() || null,
        })),
      });
      if (r.error || !r.id) {
        setError(r.error ?? "Erro ao salvar.");
        return;
      }
      router.push(`/pedidos/${r.id}`);
      router.refresh();
    });
  };

  const hasFrom = items.some((i) => products.find((p) => p.id === i.product_id)?.price_is_from);

  return (
    <div className="grid gap-5 pb-24 lg:grid-cols-[1fr_340px] lg:gap-6 lg:pb-0">
      <div className="space-y-5">
        {/* ============ CLIENTE ============ */}
        <Card>
          <CardHeader title="Cliente" />
          <div className="space-y-4 p-4 lg:p-5">
            {customer ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-bg/50 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-dark">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{customer.name}</p>
                  <p className="truncate text-[13px] text-ink-3">{customer.phone || "Sem telefone"}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                  Trocar
                </Button>
              </div>
            ) : newCustomer ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome do cliente">
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                </Field>
                <Field label="Telefone / WhatsApp">
                  <Input inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(14) 99999-9999" />
                </Field>
                <button
                  type="button"
                  onClick={() => setNewCustomer(false)}
                  className="text-left text-[13px] font-semibold text-brand hover:text-brand-dark sm:col-span-2"
                >
                  Buscar cliente já cadastrado
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nome ou telefone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {results.length > 0 && (
                  <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {results.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => pickCustomer(c)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-bg">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[13px] text-ink-3">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {search && results.length === 0 && <p className="mt-2 text-[13px] text-ink-3">Nenhum cliente encontrado.</p>}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setNewCustomer(true);
                    setNewName(search);
                    setSearch("");
                  }}
                >
                  <UserPlus className="h-4 w-4" /> Cadastrar novo cliente
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* ============ ITENS ============ */}
        <Card>
          <CardHeader
            title="Itens"
            subtitle={items.length ? `${items.length} item(ns)` : undefined}
            action={
              <Button type="button" variant="dark" size="sm" onClick={() => setDialog({ open: true, editing: null })}>
                <Plus className="h-4 w-4" strokeWidth={2.5} /> Adicionar
              </Button>
            }
          />
          {items.length === 0 ? (
            <button
              type="button"
              onClick={() => setDialog({ open: true, editing: null })}
              className="m-4 flex w-[calc(100%-2rem)] flex-col items-center rounded-xl border-2 border-dashed border-line py-8 text-ink-3 transition hover:border-line-strong hover:text-ink-2 lg:m-5 lg:w-[calc(100%-2.5rem)]"
            >
              <Plus className="h-5 w-5" />
              <span className="mt-1 text-sm font-semibold">Adicionar primeiro item</span>
            </button>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.key} className="flex items-start gap-3 px-4 py-3.5 lg:px-5">
                  <span className="num mt-0.5 min-w-14 rounded-lg bg-bg px-2 py-1 text-center text-[13px] font-bold">{qty(i.quantity, i.unit)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.product_name}</p>
                    {optionsText(i.options) && <p className="text-[13px] text-ink-2">{optionsText(i.options)}</p>}
                    {i.note && <p className="text-[13px] text-ink-3 italic">“{i.note}”</p>}
                    <p className="num mt-0.5 text-xs text-ink-3">
                      {brl(i.unit_price)} {i.unit === "kg" ? "/kg" : "/un"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num font-semibold">{brl(i.unit_price * i.quantity)}</span>
                    <div className="flex">
                      <button type="button" onClick={() => setDialog({ open: true, editing: i })} className="rounded-lg p-1.5 text-ink-3 hover:bg-bg hover:text-ink" aria-label="Editar item">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setItems((p) => p.filter((x) => x.key !== i.key))} className="rounded-lg p-1.5 text-ink-3 hover:bg-red-50 hover:text-red-600" aria-label="Remover item">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ============ ENTREGA ============ */}
        <Card>
          <CardHeader title="Entrega" />
          <div className="space-y-4 p-4 lg:p-5">
            <Segmented
              value={deliveryType}
              onChange={(v) => {
                setDeliveryType(v);
                if (v === "entrega" && !address && customer && (customer.address || customer.neighborhood))
                  setAddress([customer.address, customer.neighborhood].filter(Boolean).join(" — "));
              }}
              options={[
                { value: "retirada", label: <><Store className="h-4 w-4" /> Retirada</> },
                { value: "entrega", label: <><MapPin className="h-4 w-4" /> Entrega</> },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={deliveryType === "entrega" ? "Data e hora da entrega" : "Data e hora da retirada"}>
                <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
              {deliveryType === "entrega" && (
                <Field label="Taxa de entrega (R$)">
                  <Input inputMode="decimal" placeholder="0,00" value={fee} onChange={(e) => setFee(e.target.value)} />
                </Field>
              )}
            </div>
            {deliveryType === "entrega" && (
              <Field label="Endereço">
                <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, referência" />
              </Field>
            )}
          </div>
        </Card>

        {/* ============ PAGAMENTO ============ */}
        <Card>
          <CardHeader title="Pagamento" />
          <div className="grid gap-4 p-4 sm:grid-cols-3 lg:p-5">
            <Field label="Forma">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}>
                <option value="">A definir</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Desconto (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <Field
              label="Valor já pago (R$)"
              hint={
                <button type="button" className="font-semibold text-brand" onClick={() => setPaid(numInput(total))}>
                  Marcar como pago total
                </button>
              }
            >
              <Input inputMode="decimal" placeholder="0,00 (sinal)" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Observações" />
          <div className="p-4 lg:p-5">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tema da festa, escrita no bolo, restrições…" />
          </div>
        </Card>
      </div>

      {/* ============ RESUMO ============ */}
      <div className="lg:sticky lg:top-9 lg:self-start">
        <Card className="p-4 lg:p-5">
          <p className="font-semibold">Resumo</p>
          <dl className="num mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-ink-2">
              <dt>Subtotal</dt>
              <dd>{brl(subtotal)}</dd>
            </div>
            {deliveryType === "entrega" && (
              <div className="flex justify-between text-ink-2">
                <dt>Entrega</dt>
                <dd>{brl(parseNum(fee))}</dd>
              </div>
            )}
            {parseNum(discount) > 0 && (
              <div className="flex justify-between text-ink-2">
                <dt>Desconto</dt>
                <dd>− {brl(parseNum(discount))}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{brl(total)}</dd>
            </div>
            {parseNum(paid) > 0 && (
              <>
                <div className="flex justify-between text-emerald-700">
                  <dt>Pago</dt>
                  <dd>{brl(parseNum(paid))}</dd>
                </div>
                <div className="flex justify-between font-semibold text-red-600">
                  <dt>Falta</dt>
                  <dd>{brl(remaining)}</dd>
                </div>
              </>
            )}
          </dl>
          {hasFrom && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Há item com preço “a partir de”: confira o valor.</p>}

          {!initial && (
            <Field label="Status inicial" className="mt-4">
              <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                {STATUSES.filter((s) => s.id !== "cancelado" && s.id !== "entregue").map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="mt-4 hidden space-y-3 lg:block">
            <ErrorNote>{error}</ErrorNote>
            <Button type="button" variant="primary" size="lg" className="w-full" onClick={submit} disabled={pending}>
              <Check className="h-4 w-4" strokeWidth={2.5} /> {pending ? "Salvando…" : initial ? "Salvar alterações" : "Criar pedido"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </Card>
      </div>

      {/* Barra de salvar (celular) */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 lg:hidden">
        {error && (
          <div className="mb-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <div className="flex items-center gap-3 pb-3">
          <button type="button" onClick={() => router.back()} className="rounded-xl p-2.5 text-ink-3 hover:bg-bg" aria-label="Cancelar">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-3">Total</p>
            <p className="num text-lg leading-tight font-bold">{brl(total)}</p>
          </div>
          <Button type="button" variant="primary" size="lg" onClick={submit} disabled={pending}>
            <Check className="h-4 w-4" strokeWidth={2.5} /> {pending ? "Salvando…" : initial ? "Salvar" : "Criar pedido"}
          </Button>
        </div>
      </div>

      {dialog.open && (
        <ItemDialog
          products={products}
          lists={lists}
          editing={dialog.editing}
          onClose={() => setDialog({ open: false, editing: null })}
          onSave={(it) => upsertItem({ ...it, key: it.key || newKey() })}
        />
      )}
    </div>
  );
}
