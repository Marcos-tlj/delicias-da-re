"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, RotateCcw, Trash2 } from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { NEXT_STATUS, brl, parseNum } from "@/lib/format";
import { deleteOrder, setAmountPaid, setOrderStatus } from "../../actions";
import { Button, Card, ErrorNote, Input, Select } from "@/components/ui";

export default function OrderActions({ id, status, code }: { id: string; status: OrderStatus; code: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const next = NEXT_STATUS[status];

  const change = (to: OrderStatus) => {
    setError("");
    start(async () => {
      const r = await setOrderStatus(id, to);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  const remove = () => {
    if (!window.confirm(`Excluir o pedido #${code} de vez? Isso não pode ser desfeito.`)) return;
    start(async () => {
      const r = await deleteOrder(id);
      if (r.error) setError(r.error);
      else {
        router.push("/pedidos");
        router.refresh();
      }
    });
  };

  return (
    <Card className="p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {next && (
          <Button variant="primary" size="lg" className="flex-1 sm:flex-none" onClick={() => change(next.to)} disabled={pending}>
            {next.label} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        {status === "cancelado" && (
          <Button variant="dark" size="lg" className="flex-1 sm:flex-none" onClick={() => change("confirmado")} disabled={pending}>
            <RotateCcw className="h-4 w-4" /> Reativar pedido
          </Button>
        )}
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Select
            className="flex-1 sm:w-44"
            value={status}
            onChange={(e) => change(e.target.value as OrderStatus)}
            disabled={pending}
            aria-label="Mudar status"
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          {status !== "cancelado" && status !== "entregue" && (
            <Button
              variant="danger"
              onClick={() => window.confirm(`Cancelar o pedido #${code}? Itens do estoque voltam para o estoque.`) && change("cancelado")}
              disabled={pending}
              title="Cancelar pedido"
            >
              <Ban className="h-4 w-4" />
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
          )}
          <Button variant="ghost" onClick={remove} disabled={pending} title="Excluir pedido" aria-label="Excluir pedido">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </Card>
  );
}

export function PaymentBox({ id, total, paid }: { id: string; total: number; paid: number }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (paid >= total && total > 0) return null;

  const save = (amount: number) =>
    start(async () => {
      setError("");
      const r = await setAmountPaid(id, amount);
      if (r.error) setError(r.error);
      else {
        setValue("");
        router.refresh();
      }
    });

  return (
    <div className="mt-4 space-y-2 border-t border-line pt-4">
      <p className="text-[13px] font-semibold text-ink-2">Registrar pagamento</p>
      <div className="flex gap-2">
        <Input inputMode="decimal" placeholder="Valor recebido" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button onClick={() => parseNum(value) > 0 && save(paid + parseNum(value))} disabled={pending || !value}>
          Somar
        </Button>
      </div>
      <Button variant="dark" className="w-full" onClick={() => save(total)} disabled={pending}>
        Recebi o restante ({brl(total - paid)})
      </Button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
