import { useEffect, useState } from "react";

/**
 * Where the chat panel appears on the page. The chat is a separate widget that a
 * proxy injects into every page; it renders inside this element when it exists,
 * and floats in the corner when it does not. The marker is added after mount so
 * the widget never touches the server-rendered markup before React has hydrated it.
 */
export function ChatSlot({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div className={className} {...(mounted ? { "data-aitink-slot": "" } : {})} />;
}
