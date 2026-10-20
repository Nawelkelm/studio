"use client";

import { CheckCircle2, Copy, FileDown, MoreHorizontal, XCircle } from "lucide-react";

import { formatCurrencyWhole, formatPercent } from "@/lib/format";
import { channelLabel } from "@/lib/quotation-meta";
import type { QuotationView } from "@/lib/quotation-view";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/registry/status-badge";

export type RowActions = {
  onOpen: (view: QuotationView) => void;
  onApprove: (view: QuotationView) => void;
  /** Opens the detail with the rejection reason picker */
  onReject: (view: QuotationView) => void;
  onDuplicate: (view: QuotationView) => void;
  onPdf: (view: QuotationView) => void;
};

const shortDate = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-AR", sameYear ? { day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit", year: "2-digit" });
};

function RowMenu({ view, actions }: { view: QuotationView; actions: RowActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Acciones de la cotización de ${view.client_name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {view.status !== "aprobada" && (
          <DropdownMenuItem onSelect={() => actions.onApprove(view)}><CheckCircle2 className="mr-2 h-4 w-4 text-green-400" /> Aprobar</DropdownMenuItem>
        )}
        {view.status !== "rechazada" && (
          <DropdownMenuItem onSelect={() => actions.onReject(view)}><XCircle className="mr-2 h-4 w-4 text-red-400" /> Rechazar…</DropdownMenuItem>
        )}
        {view.status !== "pendiente" && (
          <DropdownMenuItem onSelect={() => actions.onOpen(view)}>Ver detalle</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.onDuplicate(view)}><Copy className="mr-2 h-4 w-4" /> Duplicar en el cotizador</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.onPdf(view)}><FileDown className="mr-2 h-4 w-4" /> Descargar PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QuotationList({ views, actions }: { views: QuotationView[]; actions: RowActions }) {
  return (
    <>
      {/* Phone: one card per quotation */}
      <ul className="space-y-2 md:hidden">
        {views.map((v) => (
          <li key={v.id}>
            <div className="flex items-start gap-1 rounded-lg border bg-card pr-1 hover:bg-secondary/40">
              <button type="button" onClick={() => actions.onOpen(v)} className="min-w-0 flex-1 space-y-1.5 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{v.client_name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatCurrencyWhole(v.price)}</span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{v.piece_name || "Sin nombre de pieza"}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <StatusBadge status={v.status} expired={v.isExpired} />
                  <span>{shortDate(v.created_at)}</span>
                  <span>{channelLabel(v.channel)}</span>
                  <span className="tabular-nums">margen {formatPercent(v.margin)}</span>
                </div>
              </button>
              <RowMenu view={v} actions={actions} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Canal</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Por hora</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((v) => (
              <TableRow key={v.id} className="cursor-pointer" onClick={() => actions.onOpen(v)}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">{shortDate(v.created_at)}</TableCell>
                <TableCell className="max-w-[22rem]">
                  <button type="button" className="block max-w-full text-left focus-visible:outline-none focus-visible:underline" onClick={(e) => { e.stopPropagation(); actions.onOpen(v); }}>
                    <span className="block truncate font-medium">{v.client_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{v.piece_name || "Sin nombre de pieza"} · {v.quantity} u. · {v.printer_name}</span>
                  </button>
                </TableCell>
                <TableCell className="hidden text-sm lg:table-cell">{channelLabel(v.channel)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrencyWhole(v.price)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(v.margin)}</TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums xl:table-cell">{v.profitPerHour === null ? "—" : `${formatCurrencyWhole(v.profitPerHour)}/h`}</TableCell>
                <TableCell><StatusBadge status={v.status} expired={v.isExpired} /></TableCell>
                <TableCell><RowMenu view={v} actions={actions} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
