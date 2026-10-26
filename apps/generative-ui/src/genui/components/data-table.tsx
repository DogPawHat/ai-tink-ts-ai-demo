import { type } from "arktype";
import { cn } from "@/lib/utils";
import { withContentKeys } from "../content-keys";
import { defineGenComponent } from "../define";

export default defineGenComponent({
  name: "dataTable",
  description:
    "A table of rows and columns. Use it when the user needs exact values or to compare several attributes across items. Each row is an object keyed by column key; keep it under about 50 rows.",
  schema: type({
    "caption?": "string",
    columns: type({ key: "string", label: "string", "align?": "'left' | 'right'" })
      .array()
      .atLeastLength(1)
      .atMostLength(8),
    rows: type({ "[string]": "string | number | null" }).array().atMostLength(200),
  }),
  render: ({ caption, columns, rows }) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        {caption && (
          <caption className="border-b px-3 py-2 text-left font-medium">{caption}</caption>
        )}
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-3 py-2 font-medium",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withContentKeys(rows, (row) => JSON.stringify(columns.map((c) => row[c.key]))).map(
            ({ key, item: row }) => (
              <tr key={key} className="border-t">
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        "px-3 py-2",
                        column.align === "right" || typeof value === "number"
                          ? "text-right tabular-nums"
                          : "text-left",
                      )}
                    >
                      {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  ),
});
