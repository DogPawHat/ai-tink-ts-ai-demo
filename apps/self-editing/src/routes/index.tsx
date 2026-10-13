import { createFileRoute } from "@tanstack/react-router";
import { Code2Icon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="gap-1.5">
              <SparklesIcon className="size-3.5" /> TanStack AI × Claude Code × Fly Sprites
            </Badge>
            <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
              Make this site yours.
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              Describe a change in the chat panel. The agent edits this app, and Vite shows it as
              soon as the files change.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Live workspace
          </Badge>
        </header>

        <Card className="relative min-h-[420px] overflow-hidden bg-gradient-to-br from-card via-muted/60 to-accent/70 lg:min-h-[560px]">
          <CardHeader className="relative z-10 flex flex-row items-center justify-between">
            <Badge variant="outline" className="bg-background/80">
              Live site
            </Badge>
            <Code2Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="relative z-10 flex flex-1 flex-col justify-center gap-5 px-8 pb-12 sm:px-12">
            <div className="flex size-16 items-center justify-center rounded-2xl border bg-background/85 shadow-sm">
              <SparklesIcon className="size-8 text-primary" aria-hidden="true" />
            </div>
            <div className="max-w-lg space-y-4">
              <h2 className="font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Your next idea starts here.
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Try a new color, layout, or look. This page is the agent&apos;s workspace.
              </p>
            </div>
          </CardContent>
          <div className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-primary/5 blur-3xl" />
        </Card>
      </div>
    </main>
  );
}
