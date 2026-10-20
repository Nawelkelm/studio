import { CalendarX, CheckCircle2, Clock, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Quotation } from "@/lib/supabase";

const STYLES: Record<Quotation["status"], { label: string; icon: typeof Clock; className: string }> = {
  pendiente: { label: "Pendiente", icon: Clock, className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" },
  aprobada: { label: "Aprobada", icon: CheckCircle2, className: "border-green-500/40 bg-green-500/10 text-green-300" },
  rechazada: { label: "Rechazada", icon: XCircle, className: "border-red-500/40 bg-red-500/10 text-red-300" },
};

export const statusLabel = (status: Quotation["status"]) => STYLES[status].label;

/** Status of a quotation; a pending one past its validity date also says so. */
export function StatusBadge({ status, expired = false, className }: { status: Quotation["status"]; expired?: boolean; className?: string }) {
  const { label, icon: Icon, className: tone } = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tone)}>
        <Icon className="h-3 w-3" aria-hidden /> {label}
      </span>
      {expired && (
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300">
          <CalendarX className="h-3 w-3" aria-hidden /> Vencida
        </span>
      )}
    </span>
  );
}
