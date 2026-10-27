"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useState } from "react";
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
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { AgUiChatTransport } from "@/lib/ag-ui-transport";
import { keyParts } from "@/lib/key-parts";

/** Next.js rewrites /api/agent to the Hono server (see next.config.ts). */
const transport = new AgUiChatTransport("/api/agent");

const SUGGESTIONS = [
  "Compare weekly npm downloads of zod, valibot, and arktype",
  "How active is TanStack/ai on GitHub?",
  "Should I pick hono or express for a new API?",
];

export function Chat() {
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text });
    setInput("");
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-4">
      <header className="flex items-baseline justify-between gap-4 border-b py-3">
        <h1 className="font-medium">AI SDK × TanStack AI</h1>
        <p className="text-muted-foreground text-xs">
          Next.js + AI Elements → AG-UI → Hono + TanStack AI
        </p>
      </header>

      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Ask about JavaScript libraries"
              description="The agent runs on TanStack AI behind Hono, and can look up npm downloads and GitHub stats."
            />
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} />)
          )}
          {status === "submitted" ? <Shimmer className="text-sm">Thinking…</Shimmer> : null}
          {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="flex flex-col gap-3 pb-4">
        {messages.length === 0 ? (
          <Suggestions>
            {SUGGESTIONS.map((suggestion) => (
              <Suggestion key={suggestion} suggestion={suggestion} onClick={send} />
            ))}
          </Suggestions>
        ) : null}
        <PromptInput onSubmit={({ text }) => send(text)}>
          <PromptInputBody>
            <PromptInputTextarea
              aria-label="Message"
              placeholder="Ask about a library…"
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: UIMessage }) {
  const lastIndex = message.parts.length - 1;
  return (
    <Message from={message.role}>
      <MessageContent>
        {keyParts(message.parts).map(({ key, part }, index) => {
          switch (part.type) {
            case "text":
              return <MessageResponse key={key}>{part.text}</MessageResponse>;
            case "reasoning":
              return (
                <Reasoning
                  key={key}
                  isStreaming={part.state === "streaming" && index === lastIndex}
                >
                  <ReasoningTrigger />
                  <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>
              );
            case "dynamic-tool":
              return (
                <Tool key={key}>
                  <ToolHeader type={part.type} state={part.state} toolName={part.toolName} />
                  <ToolContent>
                    <ToolInput input={part.input} />
                    <ToolOutput output={withoutReplay(part.output)} errorText={part.errorText} />
                  </ToolContent>
                </Tool>
              );
            default:
              return null;
          }
        })}
      </MessageContent>
    </Message>
  );
}

/** Web search results carry the pages' encrypted text for the server to replay; it isn't worth showing. */
function withoutReplay(output: unknown) {
  if (!output || typeof output !== "object" || !("replay" in output)) return output;
  const { replay: _replay, ...rest } = output;
  return rest;
}
