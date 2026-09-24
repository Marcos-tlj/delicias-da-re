"use client";

import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { NEXT_STATUS } from "@/lib/format";
import { setOrderStatus } from "@/app/(app)/actions";
import { buttonClass } from "./ui";

export default function QuickAdvance({ id, status, compact }: { id: string; status: OrderStatus; compact?: boolean }) {
  const [pending, start] = useTransition();
  const next = NEXT_STATUS[status];
  if (!next) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          const r = await setOrderStatus(id, next.to);
          if (r.error) alert(r.error);
        });
      }}
      className={buttonClass("secondary", "sm", compact ? "px-2.5" : undefined)}
      title={next.label}
    >
      {pending ? "…" : next.label}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}
