import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { Code2Icon, SparklesIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    threadId: "local-demo",
    connection: fetchServerSentEvents("/api/chat", () => ({ body: { sessionId } })),
    onCustomEvent: (name, value) => {
      if (
        name === "opencode.session-id" &&
        typeof value === "object" &&
        value !== null &&
        "sessionId" in value &&
        typeof value.sessionId === "string"
      ) {
        setSessionId(value.sessionId);
      }
    },
  });

  function submit(message: { text: string }) {
    const prompt = message.text.trim();
    if (!prompt || isLoading) return;
    void sendMessage(prompt);
    setDraft("");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="gap-1.5">
              <SparklesIcon className="size-3.5" /> TanStack AI × OpenCode Zen × Drop
            </Badge>
            <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
              Make this site yours.
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              Describe a change. The agent edits this app, and Vite shows it as soon as the files
              change.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Live workspace
          </Badge>
        </header>

        <section
          className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(380px,1fr)]"
          aria-label="Live site and chat"
        >
          <Card className="relative min-h-[420px] overflow-hidden bg-gradient-to-br from-card via-muted/60 to-accent/70 lg:min-h-[680px]">
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

          <Card className="flex h-[680px] min-h-0 flex-col gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between border-b py-4">
              <div className="space-y-1">
                <CardTitle>Conversation</CardTitle>
                <CardDescription>Tell the agent what to change</CardDescription>
              </div>
              <Badge variant={isLoading ? "secondary" : "outline"}>
                {isLoading ? "Working…" : "Ready"}
              </Badge>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col px-0">
              <Conversation className="min-h-0 flex-1">
                <ConversationContent className="gap-5 px-5 py-6">
                  {messages.length === 0 ? (
                    <ConversationEmptyState
                      icon={<SparklesIcon className="size-7" />}
                      title="Start with a prompt"
                      description="Try “Make the site purple.”"
                      className="min-h-[350px]"
                    />
                  ) : (
                    messages.map((message) => (
                      <Message
                        key={message.id}
                        from={message.role === "user" ? "user" : "assistant"}
                      >
                        <MessageContent>
                          {message.parts.map((part, index) => {
                            if (part.type === "text") {
                              return message.role === "user" ? (
                                <p key={index} className="whitespace-pre-wrap">
                                  {part.content}
                                </p>
                              ) : (
                                <MessageResponse key={index}>{part.content}</MessageResponse>
                              );
                            }
                            if (part.type === "tool-call") {
                              const state =
                                part.state === "complete"
                                  ? "output-available"
                                  : part.state === "error"
                                    ? "output-error"
                                    : part.state === "approval-requested" ||
                                        part.state === "approval-responded"
                                      ? part.state
                                      : part.state === "awaiting-input" ||
                                          part.state === "input-streaming"
                                        ? "input-streaming"
                                        : "input-available";
                              return (
                                <Tool key={index}>
                                  <ToolHeader
                                    type="dynamic-tool"
                                    toolName={part.name}
                                    state={state}
                                  />
                                  <ToolContent>
                                    <ToolInput input={part.input ?? part.arguments} />
                                    <ToolOutput
                                      output={part.output}
                                      errorText={part.state === "error" ? "Tool failed" : undefined}
                                    />
                                  </ToolContent>
                                </Tool>
                              );
                            }
                            return null;
                          })}
                        </MessageContent>
                      </Message>
                    ))
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              {error && (
                <p
                  className="mx-5 mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error.message}
                </p>
              )}

              <div className="border-t p-4">
                <label htmlFor="prompt" className="mb-2 block text-sm font-medium">
                  What should change?
                </label>
                <PromptInput onSubmit={submit}>
                  <PromptInputBody>
                    <PromptInputTextarea
                      id="prompt"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Describe a change to this site…"
                      disabled={isLoading}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <span className="px-2 text-xs text-muted-foreground">
                        Vite hot reload is on
                      </span>
                    </PromptInputTools>
                    <PromptInputSubmit
                      status={isLoading ? "streaming" : "ready"}
                      onStop={stop}
                      disabled={!draft.trim() && !isLoading}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
