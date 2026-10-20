const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const arsWhole = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "$ 7.050,00" */
export const formatCurrency = (value: number) => ars.format(Number.isFinite(value) ? value : 0);

/** "$ 7.050" (no cents; for summaries and charts) */
export const formatCurrencyWhole = (value: number) => arsWhole.format(Number.isFinite(value) ? value : 0);

/** "7,1 mil" */
export const formatCompact = (value: number) => compact.format(Number.isFinite(value) ? value : 0);

/** "67%" */
export const formatPercent = (value: number) => `${percent.format(Number.isFinite(value) ? value : 0)}%`;
