import { type } from "arktype";
import { defineGenComponent } from "../define";

export default defineGenComponent({
  name: "timeline",
  description:
    "A vertical list of dated events in order. Use it for histories, release notes, or plans. Write each date as it should read, e.g. 'March 2024' or 'v5.0'.",
  schema: type({
    events: type({ date: "string", title: "string", "description?": "string" })
      .array()
      .atLeastLength(1)
      .atMostLength(20),
  }),
  render: ({ events }) => (
    <ol className="relative ml-2 border-l">
      {events.map((event, i) => (
        <li key={i} className="mb-4 ml-4 last:mb-0">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
          <time className="text-xs text-muted-foreground">{event.date}</time>
          <p className="font-medium">{event.title}</p>
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}
        </li>
      ))}
    </ol>
  ),
});
