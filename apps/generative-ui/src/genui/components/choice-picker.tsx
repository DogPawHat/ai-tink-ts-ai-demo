import { useState } from "react";
import { type } from "arktype";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { defineInteractiveGenComponent } from "../define";

export default defineInteractiveGenComponent({
  name: "choicePicker",
  description:
    "Asks the user to choose and waits for their answer, which comes back as the tool result. Use it to ask clarifying questions before recommending something, one question per call. Give two to six options, each with a short label and an optional one-line description. Set multiple to true to allow several choices.",
  schema: type({
    question: "string",
    options: type({ id: "string", label: "string", "description?": "string" })
      .array()
      .atLeastLength(2)
      .atMostLength(6),
    "multiple?": "boolean",
  }),
  render: ({ args, respond, result }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const answered = respond === undefined;
    const chosen = answered && result ? parseAnswer(result) : selected;
    const toggle = (id: string) => {
      if (!args.multiple) return respond?.({ chosen: [id] });
      setSelected((current) =>
        current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
      );
    };
    return (
      <fieldset className="flex flex-col gap-2 rounded-lg border p-3" disabled={answered}>
        <legend className="px-1 text-sm font-medium">{args.question}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {args.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              aria-pressed={chosen.includes(option.id)}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2 text-left text-sm transition-colors",
                "enabled:hover:bg-muted disabled:opacity-60 aria-pressed:border-primary aria-pressed:bg-muted aria-pressed:opacity-100",
              )}
            >
              <Check
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  chosen.includes(option.id) ? "opacity-100" : "opacity-0",
                )}
              />
              <span>
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="block text-muted-foreground">{option.description}</span>
                )}
              </span>
            </button>
          ))}
        </div>
        {args.multiple && !answered && (
          <Button
            size="sm"
            className="self-end"
            disabled={selected.length === 0}
            onClick={() => respond?.({ chosen: selected })}
          >
            Continue
          </Button>
        )}
      </fieldset>
    );
  },
});

function parseAnswer(result: string): string[] {
  try {
    const parsed: unknown = JSON.parse(result);
    if (parsed && typeof parsed === "object" && "chosen" in parsed && Array.isArray(parsed.chosen))
      return parsed.chosen.map(String);
  } catch {
    // Not JSON; nothing to highlight.
  }
  return [];
}
