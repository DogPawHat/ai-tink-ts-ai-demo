import { type } from "arktype";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { defineGenComponent } from "../define";

const tones = {
  info: { icon: Info, className: "border-border bg-muted/40" },
  success: { icon: CircleCheck, className: "border-chart-2/50 bg-chart-2/10" },
  warning: { icon: TriangleAlert, className: "border-chart-4/50 bg-chart-4/10" },
  danger: { icon: CircleAlert, className: "border-destructive/50 bg-destructive/10" },
};

export default defineGenComponent({
  name: "callout",
  description:
    "A short highlighted note: a key takeaway, a tip, a warning, or a summary. One title and an optional sentence or two.",
  schema: type({
    tone: "'info' | 'success' | 'warning' | 'danger'",
    title: "string",
    "body?": "string",
  }),
  render: ({ tone, title, body }) => {
    const { icon: Icon, className } = tones[tone];
    return (
      <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", className)}>
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">{title}</p>
          {body && <p className="mt-1 text-muted-foreground">{body}</p>}
        </div>
      </div>
    );
  },
});
