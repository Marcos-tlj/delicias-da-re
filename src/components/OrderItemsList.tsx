import type { OrderItem } from "@/lib/types";
import { brl, formatQty, optionsText } from "@/lib/format";

export default function OrderItemsList({ items }: { items: OrderItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="flex justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-semibold">
              {formatQty(i.quantity, i.unit)} {i.product_name}
            </p>
            {optionsText(i.options) && <p className="text-cocoa-light">{optionsText(i.options)}</p>}
            {i.note && <p className="text-cocoa-light italic">“{i.note}”</p>}
          </div>
          <span className="shrink-0">{brl(i.line_total)}</span>
        </li>
      ))}
    </ul>
  );
}
