export type Category = "bolos" | "doces" | "tortas";
export type Unit = "un" | "kg";

export type OptionGroup = {
  name: string;
  type: "single" | "multi";
  required: boolean;
  choices: string[];
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  price: number;
  unit: Unit;
  min_quantity: number;
  quantity_step: number;
  price_is_from: boolean;
  options: OptionGroup[];
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

export type SelectedOptions = Record<string, string | string[]>;

export type OrderStatus =
  | "pendente"
  | "aceito"
  | "em_preparo"
  | "saiu_entrega"
  | "finalizado"
  | "cancelado";

export type DeliveryType = "retirada" | "delivery";
export type PaymentMethod = "pix" | "cartao_entrega";

export type Address = {
  cep?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city?: string;
  reference?: string;
};

export type OrderItem = {
  id: number;
  product_name: string;
  unit: Unit;
  unit_price: number;
  quantity: number;
  options: SelectedOptions;
  note: string | null;
  line_total: number;
};

export type Order = {
  id: string;
  code: number;
  user_id: string;
  status: OrderStatus;
  delivery_type: DeliveryType;
  address: Address | null;
  payment_method: PaymentMethod;
  customer_name: string;
  customer_phone: string;
  notes: string | null;
  scheduled_for: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "bolos", label: "Bolos", emoji: "🎂" },
  { id: "doces", label: "Doces", emoji: "🍬" },
  { id: "tortas", label: "Tortas", emoji: "🥧" },
];
