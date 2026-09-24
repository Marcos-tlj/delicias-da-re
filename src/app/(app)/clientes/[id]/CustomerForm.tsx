"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Trash2 } from "lucide-react";
import type { Customer } from "@/lib/types";
import { maskPhone, whatsappLink } from "@/lib/format";
import { deleteCustomer, saveCustomer } from "../../actions";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Textarea } from "@/components/ui";

export default function CustomerForm({ customer }: { customer: Customer | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    name: customer?.name ?? "",
    phone: maskPhone(customer?.phone ?? ""),
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    neighborhood: customer?.neighborhood ?? "",
    notes: customer?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setF((p) => ({ ...p, [k]: k === "phone" ? maskPhone(e.target.value) : e.target.value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await saveCustomer({ id: customer?.id, ...f });
      if (r.error) return setError(r.error);
      if (!customer) router.push(`/clientes/${r.id}`);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  const remove = () => {
    if (!customer || !window.confirm(`Excluir ${customer.name}? Os pedidos continuam salvos, só perdem o vínculo.`)) return;
    start(async () => {
      const r = await deleteCustomer(customer.id);
      if (r.error) setError(r.error);
      else router.push("/clientes");
    });
  };

  return (
    <Card>
      <CardHeader
        title="Dados do cliente"
        action={
          customer?.phone ? (
            <a href={whatsappLink(customer.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          ) : undefined
        }
      />
      <form onSubmit={submit} className="space-y-4 p-4 lg:p-5">
        <Field label="Nome">
          <Input required value={f.name} onChange={set("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone / WhatsApp">
            <Input inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="(14) 99999-9999" />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={f.email} onChange={set("email")} />
          </Field>
        </div>
        <Field label="Endereço">
          <Input value={f.address} onChange={set("address")} placeholder="Rua, número, complemento" />
        </Field>
        <Field label="Bairro">
          <Input value={f.neighborhood} onChange={set("neighborhood")} />
        </Field>
        <Field label="Anotações">
          <Textarea rows={3} value={f.notes} onChange={set("notes")} placeholder="Preferências, alergias, datas importantes…" />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex items-center gap-2">
          <Button variant="dark" disabled={pending}>
            {pending ? "Salvando…" : customer ? "Salvar" : "Cadastrar cliente"}
          </Button>
          {saved && <span className="text-[13px] font-semibold text-emerald-700">Salvo ✓</span>}
          {customer && (
            <Button type="button" variant="ghost" className="ml-auto text-red-600" onClick={remove} disabled={pending}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
