export type Category = "bolos" | "doces" | "tortas" | "outros";
export type Unit = "un" | "kg";
export type OrderStatus = "novo" | "confirmado" | "em_preparo" | "pronto" | "entregue" | "cancelado";
export type DeliveryType = "retirada" | "entrega";
export type PaymentMethod = "pix" | "cartao" | "dinheiro" | "outro";
export type PaymentStatus = "pendente" | "parcial" | "pago";

export type OptionGroup = { label: string; list_id: string; required: boolean; multi: boolean };
export type OptionItem = { id: string; list_id: string; name: string; is_active: boolean; sort_order: number };
export type OptionList = { id: string; name: string; sort_order: number; option_items?: OptionItem[] };

export type Product = {
  id: string;
  name: string;
  category: Category;
  description: string | null;
  price: number;
  unit: Unit;
  price_is_from: boolean;
  option_groups: OptionGroup[];
  is_active: boolean;
  stock_enabled: boolean;
  stock_qty: number;
  stock_min: number;
  sort_order: number;
  cost: number;
  cost_items: CostItem[];
  margin_pct: number;
  margin_mode: MarginMode;
  price_auto: boolean;
  price_rounding: number;
  recipe: RecipeLine[];
  recipe_yield: number;
};

export type MarginMode = "markup" | "margin";
export type CostItem = { name: string; value: number };

export type IngredientUnit = "g" | "kg" | "ml" | "l" | "un";
export type Ingredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  package_qty: number;
  package_price: number;
  notes: string | null;
  updated_at: string;
};
export type RecipeLine = { ingredient_id: string; qty: number; unit: IngredientUnit };

export type ExpenseCategory = "ingredientes" | "embalagem" | "gas_energia" | "entrega" | "equipamentos" | "divulgacao" | "outros";
export type Expense = {
  id: string;
  spent_on: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  created_at: string;
};

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: "ingredientes", label: "Ingredientes" },
  { id: "embalagem", label: "Embalagens" },
  { id: "gas_energia", label: "Gás e energia" },
  { id: "entrega", label: "Entregas" },
  { id: "equipamentos", label: "Equipamentos" },
  { id: "divulgacao", label: "Divulgação" },
  { id: "outros", label: "Outros" },
];

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  notes: string | null;
  created_at: string;
};

export type SelectedOptions = Record<string, string | string[]>;

export type OrderItem = {
  id?: number;
  product_id: string | null;
  product_name: string;
  unit: Unit;
  unit_price: number;
  quantity: number;
  options: SelectedOptions;
  note: string | null;
  line_total?: number;
  unit_cost?: number;
};

export type Order = {
  id: string;
  code: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  status: OrderStatus;
  delivery_type: DeliveryType;
  address: string | null;
  due_at: string | null;
  payment_method: PaymentMethod | null;
  amount_paid: number;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  payment_status: PaymentStatus;
  notes: string | null;
  sale_channel?: "pedido" | "balcao";
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "bolos", label: "Bolos" },
  { id: "doces", label: "Doces" },
  { id: "tortas", label: "Tortas" },
  { id: "outros", label: "Outros" },
];

export const STATUSES: { id: OrderStatus; label: string }[] = [
  { id: "novo", label: "Novo" },
  { id: "confirmado", label: "Confirmado" },
  { id: "em_preparo", label: "Em preparo" },
  { id: "pronto", label: "Pronto" },
  { id: "entregue", label: "Entregue" },
  { id: "cancelado", label: "Cancelado" },
];

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "PIX" },
  { id: "cartao", label: "Cartão" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "outro", label: "Outro" },
];
