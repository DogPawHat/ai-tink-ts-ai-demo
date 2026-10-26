import { renderToString } from "react-dom/server";
import { expect, test } from "vite-plus/test";
import { type } from "arktype";
import { Chart } from "@tanstack/charts/react";
import { chartSeries, chartSpec, toChartDefinition, type ChartSpec } from "./chart-spec";

/** Builds the definition and renders it to SVG, as SSR does. */
function render(input: unknown) {
  const spec = chartSpec.assert(input);
  return renderToString(
    <Chart
      definition={toChartDefinition(spec)}
      ariaLabel={spec.ariaLabel}
      initialWidth={640}
      height={260}
    />,
  );
}

const count = (svg: string, tag: string) => svg.split(`<${tag}`).length - 1;

const quarters = [
  { quarter: "Q1", region: "EU", revenue: 10 },
  { quarter: "Q1", region: "US", revenue: 14 },
  { quarter: "Q2", region: "EU", revenue: 12 },
  { quarter: "Q2", region: "US", revenue: 9 },
];

test("renders each mark type", () => {
  const base = { ariaLabel: "Revenue", data: quarters };
  const cases = [
    {
      x: { scale: "band" },
      y: { scale: "linear" },
      marks: [{ type: "barY", x: "quarter", y: "revenue" }],
    },
    {
      x: { scale: "linear" },
      y: { scale: "band" },
      marks: [{ type: "barX", x: "revenue", y: "quarter" }],
    },
    {
      x: { scale: "point" },
      y: { scale: "linear" },
      marks: [{ type: "lineY", x: "quarter", y: "revenue", series: "region" }],
    },
    {
      x: { scale: "point" },
      y: { scale: "linear" },
      marks: [{ type: "areaY", x: "quarter", y: "revenue", series: "region" }],
    },
    {
      x: { scale: "point" },
      y: { scale: "linear" },
      marks: [{ type: "dot", x: "quarter", y: "revenue" }],
    },
    {
      x: { scale: "band" },
      y: { scale: "linear" },
      marks: [
        { type: "barY", x: "quarter", y: "revenue" },
        { type: "ruleY", value: 11, color: "chart-3" },
      ],
    },
  ];
  for (const c of cases) {
    const svg = render({ ...base, ...c });
    expect(svg, JSON.stringify(c.marks)).toContain("<svg");
    expect(
      count(svg, "path") + count(svg, "rect") + count(svg, "line") + count(svg, "circle"),
    ).toBeGreaterThan(0);
  }
});

test("stacks series bars by default and groups them when stack is false", () => {
  const spec = {
    ariaLabel: "Revenue by region",
    data: quarters,
    x: { scale: "band" },
    y: { scale: "linear" },
    marks: [{ type: "barY", x: "quarter", y: "revenue", series: "region" }],
  };
  const stacked = render(spec);
  const grouped = render({ ...spec, marks: [{ ...spec.marks[0], stack: false }] });
  expect(stacked).toContain("<svg");
  expect(grouped).toContain("<svg");
  expect(grouped).not.toBe(stacked);
});

test("renders empty data without throwing", () => {
  const svg = render({
    ariaLabel: "Nothing yet",
    data: [],
    x: { scale: "band" },
    y: { scale: "linear" },
    marks: [{ type: "barY", x: "quarter", y: "revenue" }],
  });
  expect(svg).toContain("<svg");
});

test("parses ISO dates on a time axis and skips bad values", () => {
  const svg = render({
    ariaLabel: "Weekly downloads",
    data: [
      { week: "2026-01-05", downloads: 100 },
      { week: "2026-01-12", downloads: 140 },
      { week: "not a date", downloads: 120 },
      { week: "2026-01-19", downloads: null },
    ],
    x: { scale: "time", label: "Week" },
    y: { scale: "linear" },
    marks: [{ type: "lineY", x: "week", y: "downloads" }],
  });
  expect(svg).toContain("<svg");
  expect(svg).toContain("Week");
});

test("orders series as declared, then as they appear, with theme colors", () => {
  const spec = chartSpec.assert({
    ariaLabel: "Revenue",
    data: quarters,
    x: { scale: "band" },
    y: { scale: "linear" },
    marks: [{ type: "barY", x: "quarter", y: "revenue", series: "region" }],
    series: { US: { label: "United States", color: "chart-4" } },
  }) as ChartSpec;
  expect(chartSeries(spec)).toEqual([
    { key: "US", label: "United States", color: "var(--chart-4)" },
    { key: "EU", label: "EU", color: "var(--chart-2)" },
  ]);
});

test("rejects raw colors and too many marks", () => {
  const base = {
    ariaLabel: "Revenue",
    data: quarters,
    x: { scale: "band" },
    y: { scale: "linear" },
  };
  expect(chartSpec({ ...base, marks: [{ type: "barY", color: "#ff0000" }] })).toBeInstanceOf(
    type.errors,
  );
  const five = Array.from({ length: 5 }, () => ({ type: "dot" }));
  expect(chartSpec({ ...base, marks: five })).toBeInstanceOf(type.errors);
});
