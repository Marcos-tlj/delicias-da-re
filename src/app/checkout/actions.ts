"use server";

import { createClient } from "@/lib/supabase/server";
import type { Address, DeliveryType, PaymentMethod, SelectedOptions } from "@/lib/types";

export type PlaceOrderInput = {
  items: { product_id: string; quantity: number; options: SelectedOptions; note?: string }[];
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  address: Address | null;
  notes: string;
  scheduledFor: string | null; // ISO
};

export async function placeOrder(input: PlaceOrderInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };

  // Só IDs, quantidades e opções vão para o banco. Preços são calculados lá.
  const items = (input.items ?? []).slice(0, 30).map((i) => ({
    product_id: String(i.product_id),
    quantity: Number(i.quantity),
    options: i.options ?? {},
    note: i.note ? String(i.note).slice(0, 200) : null,
  }));

  const { data, error } = await supabase.rpc("place_order", {
    p_items: items,
    p_delivery_type: input.deliveryType,
    p_payment_method: input.paymentMethod,
    p_customer_name: String(input.customerName ?? "").slice(0, 80),
    p_customer_phone: String(input.customerPhone ?? "").slice(0, 20),
    p_address: input.deliveryType === "delivery" ? input.address : null,
    p_notes: input.notes ? String(input.notes).slice(0, 500) : null,
    p_scheduled_for: input.scheduledFor,
  });

  if (error) {
    // Mensagens de validação do banco (raise exception) são seguras para exibir.
    const msg = error.code === "P0001" ? error.message : "Não foi possível enviar o pedido. Tente novamente.";
    return { error: msg };
  }

  // Guarda nome/telefone no perfil para o próximo pedido
  await supabase
    .from("profiles")
    .update({ full_name: input.customerName.trim(), phone: input.customerPhone.trim() })
    .eq("id", user.id);

  return { id: data as string };
}
