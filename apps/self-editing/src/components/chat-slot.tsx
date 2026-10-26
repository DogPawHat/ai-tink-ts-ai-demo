import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Where the chat panel appears on the page. The chat is a separate widget that a
 * proxy injects into every page; it renders inside this element when it exists,
 * and floats in the corner when it does not. The marker is added after hydration
 * so the widget never touches the server-rendered markup before React has hydrated
 * it: the server snapshot (false) is used while hydrating, then React re-renders
 * with the client snapshot (true).
 */
export function ChatSlot({ className }: { className?: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return <div className={className} {...(hydrated ? { "data-aitink-slot": "" } : {})} />;
}
