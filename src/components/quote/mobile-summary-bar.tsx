"use client";

import { Save } from "lucide-react";

import { formatCurrencyWhole, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Props = {
  price: number;
  margin: number;
  /** Jump to the save section */
  onSave: () => void;
};

/** Phone only: keeps the price in sight while filling the form, with a shortcut to save. */
export function MobileSummaryBar({ price, margin, onSave }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Precio de venta · margen {formatPercent(margin)}</p>
        <p className="truncate text-xl font-bold tabular-nums">{formatCurrencyWhole(price)}</p>
      </div>
      <Button type="button" onClick={onSave} className="min-h-11 gap-2 shrink-0">
        <Save className="h-4 w-4" /> Guardar
      </Button>
    </div>
  );
}
