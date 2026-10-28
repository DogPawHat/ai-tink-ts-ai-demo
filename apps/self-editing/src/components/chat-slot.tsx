import { useSyncExternalStore } from "react";
import { Spinner } from "@/components/ui/spinner";

const subscribe = () => () => {};

/**
 * Where the chat panel appears on the page. The chat is a separate widget that a
 * proxy injects into every page; it renders inside this element when it exists,
 * and floats in the corner when it does not. The marker is added after hydration
 * so the widget never touches the server-rendered markup before React has hydrated
 * it: the server snapshot (false) is used while hydrating, then React re-renders
 * with the client snapshot (true).
 *
 * Until the widget arrives, the slot shows a placeholder panel. The widget appends
 * its element after the placeholder, which hides it.
 */
export function ChatSlot({ className }: { className?: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div className={className} {...(hydrated ? { "data-aitink-slot": "" } : {})}>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground [&:has(+#aitink-widget)]:hidden">
        <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          Site agent
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading the chat…
        </div>
        <div className="border-t p-3">
          <div className="h-9 rounded-lg border bg-muted/50" />
        </div>
      </div>
    </div>
  );
}
