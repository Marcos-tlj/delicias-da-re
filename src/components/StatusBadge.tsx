import type { DeliveryType, OrderStatus } from "@/lib/types";
import { STATUS_STYLE, statusLabel } from "@/lib/format";

export default function StatusBadge({ status, delivery }: { status: OrderStatus; delivery: DeliveryType }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
      {statusLabel(status, delivery)}
    </span>
  );
}
