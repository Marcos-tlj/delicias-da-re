"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { brl, formatQty } from "@/lib/format";
import type { Address, DeliveryType, PaymentMethod } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { placeOrder } from "./actions";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function localMin() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const input =
  "w-full rounded-2xl border border-cream-dark bg-white px-4 py-3 outline-none focus:border-cocoa";

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint: string; icon: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-2xl border-2 p-3 text-left transition ${
            value === o.value ? "border-berry bg-white" : "border-transparent bg-white/60"
          }`}
        >
          <span className="text-2xl">{o.icon}</span>
          <p className="mt-1 font-bold">{o.label}</p>
          <p className="text-xs text-cocoa-light">{o.hint}</p>
        </button>
      ))}
    </div>
  );
}

export default function CheckoutForm({ defaultName, defaultPhone }: { defaultName: string; defaultPhone: string }) {
  const router = useRouter();
  const { items, subtotal, ready, clear } = useCart();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(maskPhone(defaultPhone));
  const [delivery, setDelivery] = useState<DeliveryType>("retirada");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [scheduled, setScheduled] = useState("");
  const [notes, setNotes] = useState("");
  const [addr, setAddr] = useState<Address>({ cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", reference: "" });

  const setA = (k: keyof Address, v: string) => setAddr((a) => ({ ...a, [k]: v }));

  const lookupCep = async (cep: string) => {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro)
        setAddr((a) => ({
          ...a,
          street: a.street || j.logradouro || "",
          neighborhood: a.neighborhood || j.bairro || "",
          city: j.localidade ? `${j.localidade}/${j.uf}` : a.city,
        }));
    } catch {
      /* CEP é só conveniência */
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await placeOrder({
        items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity, options: i.options, note: i.note })),
        deliveryType: delivery,
        paymentMethod: payment,
        customerName: name,
        customerPhone: phone,
        address: delivery === "delivery" ? addr : null,
        notes,
        scheduledFor: scheduled ? new Date(scheduled).toISOString() : null,
      });
      if (res.error || !res.id) {
        setError(res.error ?? "Erro inesperado.");
        return;
      }
      clear();
      router.replace(`/pedidos/${res.id}?novo=1`);
    });
  };

  if (ready && items.length === 0 && !pending) {
    return (
      <div>
        <PageHeader title="Finalizar pedido" back="/" />
        <div className="p-8 text-center">
          <p>Sua sacola está vazia.</p>
          <Link href="/" className="mt-4 inline-block font-bold text-berry">
            Ver cardápio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="pb-44">
      <PageHeader title="Finalizar pedido" back="/carrinho" />

      <div className="space-y-6 p-4">
        <section>
          <h2 className="mb-2 font-bold">Seus dados</h2>
          <div className="space-y-2">
            <input className={input} required placeholder="Nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              className={input}
              required
              placeholder="WhatsApp com DDD"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              pattern="\(\d{2}\) \d{4,5}-\d{4}"
              title="Ex.: (14) 99999-9999"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Como você quer receber?</h2>
          <Segmented
            value={delivery}
            onChange={setDelivery}
            options={[
              { value: "retirada", label: "Retirada", hint: "Busco na confeitaria", icon: "🏠" },
              { value: "delivery", label: "Entrega", hint: "Taxa a combinar", icon: "🛵" },
            ]}
          />
          {delivery === "delivery" && (
            <div className="animate-fade-in mt-3 space-y-2">
              <input
                className={input}
                placeholder="CEP (opcional)"
                inputMode="numeric"
                autoComplete="postal-code"
                value={addr.cep}
                onChange={(e) => setA("cep", e.target.value)}
                onBlur={(e) => lookupCep(e.target.value)}
              />
              <input className={input} required placeholder="Rua" autoComplete="address-line1" value={addr.street} onChange={(e) => setA("street", e.target.value)} />
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <input className={input} required placeholder="Número" inputMode="numeric" value={addr.number} onChange={(e) => setA("number", e.target.value)} />
                <input className={input} placeholder="Complemento" value={addr.complement} onChange={(e) => setA("complement", e.target.value)} />
              </div>
              <input className={input} required placeholder="Bairro" value={addr.neighborhood} onChange={(e) => setA("neighborhood", e.target.value)} />
              <input className={input} placeholder="Ponto de referência" value={addr.reference} onChange={(e) => setA("reference", e.target.value)} />
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-bold">Para quando? <span className="font-normal text-cocoa-light">(opcional)</span></h2>
          <input
            type="datetime-local"
            className={input}
            min={localMin()}
            value={scheduled}
            onChange={(e) => setScheduled(e.target.value)}
          />
          <p className="mt-1 text-xs text-cocoa-light">Bolos de festa: peça com antecedência. Confirmamos a data pelo WhatsApp.</p>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Pagamento</h2>
          <Segmented
            value={payment}
            onChange={setPayment}
            options={[
              { value: "pix", label: "PIX", hint: "Chave enviada após o pedido", icon: "⚡" },
              { value: "cartao_entrega", label: "Cartão", hint: delivery === "delivery" ? "Na entrega" : "Na retirada", icon: "💳" },
            ]}
          />
          <p className="mt-2 text-xs text-cocoa-light">Nenhum pagamento é feito pelo site.</p>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Observações</h2>
          <textarea
            className={input}
            rows={3}
            maxLength={500}
            placeholder="Ex.: tema da festa, restrições, horário preferido…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        <section className="rounded-3xl bg-white p-4">
          <h2 className="mb-2 font-bold">Resumo</h2>
          <ul className="space-y-1 text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-2">
                <span>
                  {formatQty(i.quantity, i.unit)} {i.name}
                </span>
                <span className="shrink-0">{brl(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          {delivery === "delivery" && (
            <p className="mt-2 flex justify-between text-sm text-cocoa-light">
              <span>Taxa de entrega</span>
              <span>a combinar</span>
            </p>
          )}
        </section>

        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-cream-dark bg-white px-4 pt-3">
        <div className="mx-auto max-w-md">
          <button
            disabled={pending || !ready}
            className="flex w-full items-center justify-between rounded-2xl bg-berry px-5 py-4 font-bold text-white disabled:opacity-60"
          >
            <span>{pending ? "Enviando…" : "Enviar pedido"}</span>
            <span>{brl(subtotal)}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
