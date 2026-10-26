import { type } from "arktype";
import { areaY, barX, barY, defineChart, dot, group, lineY, ruleY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleUtc } from "d3-scale";

/**
 * A JSON description of a chart, small enough for a model to write. A chart
 * definition holds scale factories and functions, so it can't come from the
 * model directly; `toChartDefinition` builds one from this.
 */

const colorToken = type("'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5'");

const mark = type({
  type: "'barY' | 'barX' | 'lineY' | 'areaY' | 'dot' | 'ruleY'",
  "x?": "string",
  "y?": "string",
  "series?": "string",
  "stack?": "boolean",
  "value?": "number",
  "color?": colorToken,
});

export const chartSpec = type({
  "title?": "string",
  ariaLabel: "string",
  data: type({ "[string]": "string | number | null" }).array().atMostLength(1000),
  x: { scale: "'band' | 'point' | 'linear' | 'time'", "label?": "string" },
  y: { scale: "'band' | 'linear'", "label?": "string" },
  marks: mark.array().atLeastLength(1).atMostLength(4),
  "series?": type({ "[string]": { label: "string", "color?": colorToken } }),
});

export type ChartSpec = typeof chartSpec.infer;
export type ChartMarkSpec = ChartSpec["marks"][number];
export type ChartRow = ChartSpec["data"][number];
type Row = Record<string, string | number | Date | null>;

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

/** Series in a stable order: as declared, then any others in data order. */
export function chartSeries(spec: ChartSpec): ChartSeries[] {
  const keys = new Set(Object.keys(spec.series ?? {}));
  for (const m of spec.marks) {
    if (!m.series) continue;
    for (const row of spec.data) {
      const value = row[m.series];
      if (value !== null && value !== undefined) keys.add(String(value));
    }
  }
  return [...keys].map((key, i) => ({
    key,
    label: spec.series?.[key]?.label ?? key,
    color: `var(--${spec.series?.[key]?.color ?? `chart-${(i % 5) + 1}`})`,
  }));
}

function positionScale(kind: ChartSpec["x"]["scale"] | ChartSpec["y"]["scale"]) {
  switch (kind) {
    case "band":
      return () => scaleBand<string>().padding(0.2);
    case "point":
      return () => scalePoint<string>().padding(0.2);
    case "linear":
      return scaleLinear;
    case "time":
      return scaleUtc;
  }
}

/** Time axes need Date values; the model sends ISO strings. */
function prepareRows(spec: ChartSpec): Row[] {
  if (spec.x.scale !== "time") return spec.data;
  const timeFields = new Set(spec.marks.map((m) => m.x).filter((f) => f !== undefined));
  return spec.data.map((row) => {
    const copy: Row = { ...row };
    for (const field of timeFields) {
      const value = row[field];
      const date = value === null || value === undefined ? null : new Date(value);
      copy[field] = date && !Number.isNaN(date.getTime()) ? date : null;
    }
    return copy;
  });
}

/** Reads a field as a number; the model sometimes sends numbers as strings. */
function numeric(field: string) {
  return (row: Row) => {
    const value = row[field];
    if (value === null || value === undefined || value instanceof Date) return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };
}

/** Reads a field as a position on a band, point, time, or linear axis. */
function position(field: string, kind: ChartSpec["x"]["scale"] | ChartSpec["y"]["scale"]) {
  if (kind === "linear") return numeric(field);
  return (row: Row) => {
    const value = row[field];
    if (value === null || value === undefined) return null;
    return value instanceof Date ? value : String(value);
  };
}

function buildMark(spec: ChartSpec, m: ChartMarkSpec, rows: Row[]) {
  const value = (field: string | undefined) => (field ? numeric(field) : () => null);
  const at = (
    field: string | undefined,
    kind: ChartSpec["x"]["scale"] | ChartSpec["y"]["scale"],
  ) => (field ? position(field, kind) : () => null);
  const present = (field: string | undefined) =>
    field ? rows.filter((row) => numeric(field)(row) !== null) : rows;
  const seriesKey = m.series;
  const series = seriesKey
    ? {
        z: (row: Row) => String(row[seriesKey] ?? ""),
        color: (row: Row) => String(row[seriesKey] ?? ""),
      }
    : {};
  const paint = m.color ? `var(--${m.color})` : "var(--chart-1)";
  const grouped = seriesKey && m.stack === false ? { layout: group() } : {};
  switch (m.type) {
    case "barY":
      return barY(present(m.y), {
        x: at(m.x, spec.x.scale),
        y: value(m.y),
        ...series,
        ...grouped,
        ...(seriesKey ? {} : { fill: paint }),
      });
    case "barX":
      return barX(present(m.x), {
        x: value(m.x),
        y: at(m.y, spec.y.scale),
        ...series,
        ...grouped,
        ...(seriesKey ? {} : { fill: paint }),
      });
    case "lineY":
      return lineY(present(m.y), {
        x: at(m.x, spec.x.scale),
        y: value(m.y),
        ...series,
        points: true,
        ...(seriesKey ? {} : { stroke: paint }),
      });
    case "areaY":
      return m.stack === false
        ? areaY(present(m.y), {
            x: at(m.x, spec.x.scale),
            y1: 0,
            y2: value(m.y),
            ...series,
            fillOpacity: 0.35,
            ...(seriesKey ? {} : { fill: paint }),
          })
        : areaY(present(m.y), {
            x: at(m.x, spec.x.scale),
            y: value(m.y),
            ...series,
            fillOpacity: 0.35,
            ...(seriesKey ? {} : { fill: paint }),
          });
    case "dot":
      return dot(present(m.y), {
        x: at(m.x, spec.x.scale),
        y: value(m.y),
        ...series,
        ...(seriesKey ? {} : { fill: paint }),
      });
    case "ruleY": {
      // Reference lines are guides, not data: muted unless given a color.
      const stroke = m.color ? paint : "var(--muted-foreground)";
      return m.value !== undefined
        ? ruleY([m.value], { stroke, strokeDasharray: "4 3" })
        : ruleY(present(m.y), { y: value(m.y), stroke, strokeDasharray: "4 3" });
    }
  }
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function axisOptions(axis: ChartSpec["x"] | ChartSpec["y"]) {
  return {
    ...(axis.label && { label: axis.label }),
    ...(axis.scale === "linear" && { ticks: { format: (value: number) => compact.format(value) } }),
  };
}

export function toChartDefinition(spec: ChartSpec) {
  const rows = prepareRows(spec);
  const series = chartSeries(spec);
  const marks = spec.marks.map((m) => buildMark(spec, m, rows));
  return defineChart({
    marks,
    scales: {
      x: {
        scale: positionScale(spec.x.scale),
        axis: axisOptions(spec.x),
        grid: spec.x.scale === "linear",
      },
      y: {
        scale: positionScale(spec.y.scale),
        axis: axisOptions(spec.y),
        grid: spec.y.scale === "linear",
        nice: spec.y.scale === "linear",
      },
    },
    ...(series.length > 0 && {
      color: {
        scale: () =>
          scaleOrdinal<string, string>()
            .domain(series.map((s) => s.key))
            .range(series.map((s) => s.color)),
      },
    }),
    tooltip,
  });
}
