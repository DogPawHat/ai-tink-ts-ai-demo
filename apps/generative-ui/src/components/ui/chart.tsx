import type * as React from "react";
import type { ChartPoint } from "@tanstack/charts";
import { Chart as TanStackChart, type ChartProps } from "@tanstack/charts/react/tooltip";
import { cn } from "cn";

/**
 * shadcn's chart pieces, rebuilt on TanStack Charts. The container maps the
 * site's theme tokens onto TanStack's `--ts-chart-*` palette and sets the text
 * color the axes and grid inherit, so charts follow light and dark mode.
 */

export interface ChartSeriesItem {
  key: string;
  label: string;
  /** A CSS color, normally `var(--chart-N)`. */
  color: string;
}

function ChartContainer({ className, ...props }: React.ComponentProps<"figure">) {
  return (
    <figure
      data-slot="chart"
      className={cn(
        "flex flex-col gap-3 text-xs text-muted-foreground",
        "[--ts-chart-1:var(--chart-1)] [--ts-chart-2:var(--chart-2)] [--ts-chart-3:var(--chart-3)]",
        "[--ts-chart-4:var(--chart-4)] [--ts-chart-5:var(--chart-5)] [--ts-chart-6:var(--chart-1)]",
        "[&_.ts-chart-host]:w-full",
        className,
      )}
      {...props}
    />
  );
}

function ChartLegend({
  series,
  className,
}: {
  series: readonly ChartSeriesItem[];
  className?: string;
}) {
  if (series.length < 2) return null;
  return (
    <ul
      data-slot="chart-legend"
      className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1", className)}
    >
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-foreground">
          <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function formatValue(value: unknown) {
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "number") return value.toLocaleString();
  return typeof value === "string" ? value : "";
}

function ChartTooltipContent({
  points,
  series,
}: {
  points: readonly ChartPoint[];
  series: readonly ChartSeriesItem[];
}) {
  if (points.length === 0) return null;
  const labels = new Map(series.map((s) => [s.key, s.label]));
  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-foreground">{formatValue(points[0]?.xValue)}</p>
      {points.map((point) => (
        <div key={point.key} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: point.color }}
          />
          <span className="text-muted-foreground">
            {labels.get(String(point.group)) ?? point.groupLabel}
          </span>
          <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
            {formatValue(point.yValue)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Chart({
  definition,
  series = [],
  ariaLabel,
  height = 260,
}: {
  definition: ChartProps<any>["definition"];
  series?: readonly ChartSeriesItem[];
  ariaLabel: string;
  height?: number;
}) {
  return (
    <TanStackChart
      definition={definition}
      ariaLabel={ariaLabel}
      height={height}
      initialWidth={640}
      renderTooltipBody={({ points }) => <ChartTooltipContent points={points} series={series} />}
    />
  );
}

export { Chart, ChartContainer, ChartLegend, ChartTooltipContent };
