import { type } from "arktype";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { defineGenComponent } from "../define";

export default defineGenComponent({
  name: "statRow",
  description:
    "A row of two to six headline numbers, each with a short label and an optional change. Use it for key figures at a glance, such as totals, counts, or rates. Format each value as it should read, e.g. '4.2M' or '38%'.",
  schema: type({
    stats: type({
      label: "string",
      value: "string",
      "change?": "string",
      "trend?": "'up' | 'down' | 'flat'",
    })
      .array()
      .atLeastLength(1)
      .atMostLength(6),
  }),
  render: ({ stats }) => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{stat.label}</span>
            <span className="text-2xl font-semibold tabular-nums">{stat.value}</span>
            {stat.change && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs",
                  stat.trend === "down" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {stat.trend === "up" && <ArrowUpRight className="size-3" />}
                {stat.trend === "down" && <ArrowDownRight className="size-3" />}
                {stat.change}
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  ),
});
