import { formatCurrencyWhole } from "@/lib/format";
import { ladderScale, spreadLabels, type LadderInput } from "@/lib/price-advisor";

type Label = { key: string; position: number; name: string; value: number; emphasis?: boolean };

function LabelRow({ labels, row }: { labels: Label[]; row: "top" | "bottom" }) {
  return (
    <>
      {spreadLabels(labels).map((l) => (
        <div
          key={l.key}
          className={`absolute -translate-x-1/2 whitespace-nowrap text-center text-[11px] leading-tight ${row === "top" ? "bottom-[calc(50%+14px)]" : "top-[calc(50%+14px)]"}`}
          style={{ left: `${l.left}%` }}
        >
          <span className={`block ${l.emphasis ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{l.name}</span>
          <span className={`block tabular-nums ${l.emphasis ? "font-semibold text-foreground" : "text-foreground/80"}`}>{formatCurrencyWhole(l.value)}</span>
        </div>
      ))}
    </>
  );
}

/**
 * Where the suggested range sits between the production cost and the price currently on screen.
 * The band is the AI's range (minimum to premium); the dot is the recommendation.
 */
export function PriceLadder(input: LadderInput) {
  const { position } = ladderScale(input);
  const min = position(input.minimo);
  const max = position(input.premium);

  const top: Label[] = [
    { key: "current", position: position(input.current), name: "Tu precio", value: input.current },
    { key: "rec", position: position(input.recomendado), name: "Recomendado", value: input.recomendado, emphasis: true },
  ];
  const bottom: Label[] = [
    { key: "cost", position: position(input.cost), name: "Costo", value: input.cost },
    { key: "min", position: min, name: "Mínimo", value: input.minimo },
    { key: "prem", position: max, name: "Premium", value: input.premium },
  ];

  return (
    <div className="px-9 py-2">
      <div
        role="img"
        aria-label={`Escala de precios por unidad: costo ${formatCurrencyWhole(input.cost)}, mínimo ${formatCurrencyWhole(input.minimo)}, recomendado ${formatCurrencyWhole(input.recomendado)}, premium ${formatCurrencyWhole(input.premium)}, tu precio actual ${formatCurrencyWhole(input.current)}`}
        className="relative h-24"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/50" style={{ left: `${min}%`, width: `${Math.max(0, max - min)}%` }} />
        <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-muted-foreground" style={{ left: `${position(input.cost)}%` }} />
        <div className="absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground" style={{ left: `${position(input.current)}%` }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/25" style={{ left: `${position(input.recomendado)}%` }} />
        <LabelRow labels={top} row="top" />
        <LabelRow labels={bottom} row="bottom" />
      </div>
    </div>
  );
}
