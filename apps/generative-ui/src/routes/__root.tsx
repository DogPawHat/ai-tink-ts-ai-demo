import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import appCss from "../style.css?url";

/**
 * The site's CSS follows prefers-color-scheme directly, but CopilotKit's chat
 * only darkens under a .dark class, so keep that class in step with the system.
 */
const FOLLOW_SYSTEM_THEME = `(() => {
  const query = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", query.matches);
  apply();
  query.addEventListener("change", apply);
})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "Generative UI" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [{ children: FOLLOW_SYSTEM_THEME }],
  }),
  shellComponent: Shell,
  component: Root,
});

function Root() {
  // Components that load their own data use useSuspenseQuery under this client.
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
