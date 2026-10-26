import { useMemo } from "react";
import { Chart, ChartContainer, ChartLegend } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { chartSeries, chartSpec, toChartDefinition, type ChartSpec } from "@/lib/chart-spec";
import { defineGenComponent } from "../define";

function ChartView(spec: ChartSpec) {
  const definition = useMemo(() => toChartDefinition(spec), [spec]);
  const series = useMemo(() => chartSeries(spec), [spec]);
  return (
    <ChartContainer className="rounded-lg border p-3">
      {spec.title && (
        <figcaption className="text-sm font-medium text-foreground">{spec.title}</figcaption>
      )}
      {spec.data.length === 0 ? (
        <p className="py-10 text-center">No data to show.</p>
      ) : (
        <Chart definition={definition} series={series} ariaLabel={spec.ariaLabel} />
      )}
      <ChartLegend series={series} />
    </ChartContainer>
  );
}

export default defineGenComponent({
  name: "chart",
  description: `A chart drawn from data rows. Use it when the answer is a comparison, trend, distribution, or relationship in numbers.

How to choose:
1. State the question the chart answers in one sentence; put it in ariaLabel.
2. Classify each field: quantitative (numbers), temporal (dates), or categorical.
3. Use the fewest marks that answer the question:
   - categories compared: barY (x categorical, y numeric) or barX for long labels (x numeric, y categorical)
   - change over time: lineY, or areaY for totals made of parts
   - relationship between two numbers: dot
   - a target or threshold: add a ruleY mark with value; don't add it to the data
4. Scales: x.scale is 'time' for dates (send ISO 8601 strings), 'band' for categories with bars, 'point' for categories with lines or dots, 'linear' for numbers. y.scale is 'linear', or 'band' for barX.
5. Several series: use long data (one row per x and series) and set the mark's series to the field that names the series. Bars and areas stack by default; set stack: false to place bars side by side or overlap areas. Give series readable labels in the series map.

Colors: never send color values. Optionally name a theme token ('chart-1' to 'chart-5') per series or per mark.
Keep data to what the question needs, at most a few hundred rows.`,
  schema: chartSpec,
  render: ChartView,
  skeleton: () => <Skeleton className="h-72 w-full" />,
});
