"use client";

import { Download, FileSpreadsheet, FileText, RefreshCw, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { CHANNELS } from "@/lib/quotation-meta";
import { SORT_LABELS, type Period, type SortKey, type StatusFilter, type ViewFilters } from "@/lib/quotation-view";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendiente", label: "Pendientes" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "rechazada", label: "Rechazadas" },
];

const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "Todo el historial" },
  { value: "month", label: "Este mes" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
];

type Props = {
  filters: ViewFilters;
  onFiltersChange: (patch: Partial<ViewFilters>) => void;
  counts: Record<StatusFilter, number>;
  printers: string[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  loading: boolean;
  canExport: boolean;
  onRefresh: () => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
};

export function RegistryToolbar({ filters, onFiltersChange, counts, printers, sort, onSortChange, loading, canExport, onRefresh, onExportPdf, onExportCsv }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar cotizaciones"
            placeholder="Cliente o pieza"
            className="pl-9 pr-9"
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
          />
          {filters.search && (
            <button type="button" aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => onFiltersChange({ search: "" })}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} aria-label="Actualizar">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={!canExport}><Download className="h-4 w-4" /><span className="hidden sm:inline">Exportar</span></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onExportPdf}><FileText className="mr-2 h-4 w-4" /> PDF (lo que ves)</DropdownMenuItem>
            <DropdownMenuItem onSelect={onExportCsv}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel / CSV (lo que ves)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div role="radiogroup" aria-label="Estado" className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={filters.status === chip.value}
            onClick={() => onFiltersChange({ status: chip.value })}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filters.status === chip.value ? "border-primary bg-primary/15 font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {chip.label} <span className="tabular-nums opacity-70">{counts[chip.value]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select value={filters.channel} onValueChange={(v) => onFiltersChange({ channel: v as ViewFilters["channel"] })}>
          <SelectTrigger aria-label="Canal"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los canales</SelectItem>
            {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.printer} onValueChange={(v) => onFiltersChange({ printer: v })}>
          <SelectTrigger aria-label="Impresora"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Impresoras</SelectItem>
            {printers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.period} onValueChange={(v) => onFiltersChange({ period: v as Period })}>
          <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
          <SelectTrigger aria-label="Ordenar por"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}
