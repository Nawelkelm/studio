"use client";

import { useMemo, useState } from "react";
import { ClipboardList, SearchX } from "lucide-react";

import {
  DEFAULT_FILTERS, countByStatus, filterViews, filterWithoutStatus, printerNames, sortViews, toView,
  type QuotationEdit, type QuotationListItem, type QuotationView, type SortKey, type ViewFilters,
} from "@/lib/quotation-view";
import type { LostReason, QuotationSnapshot } from "@/lib/quotation-meta";
import type { Quotation } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryStrip } from "@/components/quotation-stats";
import { InsightsView } from "@/components/registry/insights-view";
import { QuotationDetail } from "@/components/registry/quotation-detail";
import { QuotationList, type RowActions } from "@/components/registry/quotation-list";
import { RegistryToolbar } from "@/components/registry/registry-toolbar";

const PAGE_SIZE = 30;

export type RegistryActions = {
  refresh: () => void;
  setStatus: (id: string, status: Quotation["status"], lostReason?: LostReason) => Promise<boolean>;
  update: (id: string, patch: QuotationEdit) => Promise<boolean>;
  loadSnapshot: (id: string) => Promise<QuotationSnapshot | null>;
  duplicate: (view: QuotationView) => void;
  downloadPdf: (view: QuotationView) => Promise<void> | void;
  exportPdf: (views: QuotationView[]) => void;
  exportCsv: (views: QuotationView[]) => void;
  goToCalculator: () => void;
};

type Props = {
  items: QuotationListItem[];
  loading: boolean;
  actions: RegistryActions;
  /** Injectable for tests and previews */
  now?: Date;
};

/** The quotations screen. It only receives data and callbacks, so it can be rendered without a backend. */
export function RegistryView({ items, loading, actions, now }: Props) {
  const [tab, setTab] = useState("lista");
  const [filters, setFilters] = useState<ViewFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("recent");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectOnOpen, setRejectOnOpen] = useState(false);

  const views = useMemo(() => items.map((q) => toView(q, now)), [items, now]);
  const counts = useMemo(() => countByStatus(filterWithoutStatus(views, filters, now)), [views, filters, now]);
  const filtered = useMemo(() => sortViews(filterViews(views, filters, now), sort), [views, filters, sort, now]);
  const visible = filtered.slice(0, limit);
  const printers = useMemo(() => printerNames(views), [views]);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const statsInput = useMemo(
    () => views.map((v) => ({ status: v.status, total_cost: v.total_cost, selling_price: v.price, created_at: v.created_at })),
    [views],
  );
  const selected = openId ? views.find((v) => v.id === openId) ?? null : null;

  const changeFilters = (patch: Partial<ViewFilters>) => { setFilters((f) => ({ ...f, ...patch })); setLimit(PAGE_SIZE); };

  const open = (view: QuotationView, reject = false) => { setRejectOnOpen(reject); setOpenId(view.id); };
  const rowActions: RowActions = {
    onOpen: (v) => open(v),
    onApprove: (v) => void actions.setStatus(v.id, "aprobada"),
    onReject: (v) => open(v, true),
    onDuplicate: actions.duplicate,
    onPdf: (v) => void actions.downloadPdf(v),
  };

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="lista">Cotizaciones</TabsTrigger>
          <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-5 space-y-4">
          {views.length > 0 && <SummaryStrip quotations={statsInput} />}
          <RegistryToolbar
            filters={filters}
            onFiltersChange={changeFilters}
            counts={counts}
            printers={printers}
            sort={sort}
            onSortChange={setSort}
            loading={loading}
            canExport={filtered.length > 0}
            onRefresh={actions.refresh}
            onExportPdf={() => actions.exportPdf(filtered)}
            onExportCsv={() => actions.exportCsv(filtered)}
          />

          {loading && items.length === 0 ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : views.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-12 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="font-medium">Todavía no hay cotizaciones</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Las que guardes desde la calculadora aparecen acá, con su margen, su estado y cuánto rindió cada hora de impresión.
              </p>
              <Button className="mt-4" onClick={actions.goToCalculator}>Ir a la calculadora</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <SearchX className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">Ninguna cotización coincide</p>
              <p className="mt-1 text-sm text-muted-foreground">Probá con otra búsqueda o sacá algún filtro.</p>
              <Button variant="outline" className="mt-4" onClick={() => changeFilters(DEFAULT_FILTERS)}>Limpiar filtros</Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {filtersActive ? `${filtered.length} de ${views.length} cotizaciones` : `${views.length} cotizaciones`}
                {filtersActive && <button type="button" className="ml-3 underline underline-offset-2 hover:text-foreground" onClick={() => changeFilters(DEFAULT_FILTERS)}>Limpiar filtros</button>}
              </p>
              <QuotationList views={visible} actions={rowActions} />
              {filtered.length > visible.length && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Mostrar más ({filtered.length - visible.length} restantes)</Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="rendimiento" className="mt-5">
          {views.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Cuando tengas cotizaciones guardadas, acá vas a ver qué trabajos rinden más, qué canales convierten y por qué se pierden ventas.
            </p>
          ) : (
            <InsightsView views={views} />
          )}
        </TabsContent>
      </Tabs>

      <QuotationDetail
        view={selected}
        startRejecting={rejectOnOpen}
        onClose={() => { setOpenId(null); setRejectOnOpen(false); }}
        onSetStatus={actions.setStatus}
        onUpdate={actions.update}
        onLoadSnapshot={actions.loadSnapshot}
        onDuplicate={actions.duplicate}
        onPdf={actions.downloadPdf}
      />
    </div>
  );
}
