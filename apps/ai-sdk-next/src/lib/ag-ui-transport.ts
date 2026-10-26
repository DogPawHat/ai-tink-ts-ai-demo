import {
  EventType,
  type AGUIEvent,
  type Message,
  type RunAgentInput,
  type ToolCall,
  type ToolCallResultEvent,
} from "@ag-ui/core";
import {
  generateId,
  type ChatTransport,
  type FinishReason,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

/**
 * Lets the AI SDK's `useChat` talk to an AG-UI agent, here TanStack AI's
 * `chat()` on Hono. Requests go out as an AG-UI `RunAgentInput`; the
 * server-sent AG-UI events come back as the AI SDK's UI message chunks.
 *
 * Server tools aren't declared in the browser, so they arrive as dynamic tool
 * parts. Reasoning is shown but not sent back: each request starts a new user
 * turn, and Claude doesn't need earlier turns' thinking.
 */
export class AgUiChatTransport implements ChatTransport<UIMessage> {
  constructor(private readonly api: string) {}

  async sendMessages({
    chatId,
    messages,
    abortSignal,
    headers,
  }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]) {
    const response = await fetch(this.api, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        ...Object.fromEntries(new Headers(headers)),
      },
      body: JSON.stringify(toRunAgentInput(chatId, messages)),
      signal: abortSignal,
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `The agent returned ${response.status}.`);
    }
    return response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(serverSentEvents())
      .pipeThrough(agUiToUIMessageChunks());
  }

  /** The server keeps no streams to resume. */
  async reconnectToStream() {
    return null;
  }
}

// --- Request: AI SDK messages → AG-UI ---------------------------------------

export function toRunAgentInput(threadId: string, messages: UIMessage[]): RunAgentInput {
  return {
    threadId,
    runId: generateId(),
    state: {},
    messages: toAgUiMessages(messages),
    tools: [],
    context: [],
    forwardedProps: {},
  };
}

type Part = UIMessage["parts"][number];

function isToolPart(part: Part): part is Extract<Part, { toolCallId: string }> {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function toolName(part: Extract<Part, { toolCallId: string }>) {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
}

/**
 * Flattens the AI SDK's one-message-per-turn history into AG-UI's messages.
 * An assistant turn with tool calls becomes, per step, an assistant message
 * with its text and calls, followed by one tool message per result. Calls
 * without a result (still streaming, or stopped) are left out, since Claude
 * rejects a tool call that has no result.
 */
export function toAgUiMessages(messages: UIMessage[]): Message[] {
  const out: Message[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") {
      const content = message.parts
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join("\n");
      out.push({ id: message.id, role: message.role, content });
      continue;
    }

    let step = 0;
    let text = "";
    let calls: ToolCall[] = [];
    let results: Message[] = [];
    const flush = () => {
      if (text || calls.length) {
        out.push({
          id: step === 0 ? message.id : `${message.id}-${step}`,
          role: "assistant",
          content: text,
          ...(calls.length ? { toolCalls: calls } : {}),
        });
        out.push(...results);
        step++;
      }
      text = "";
      calls = [];
      results = [];
    };

    for (const part of message.parts) {
      if (part.type === "step-start") flush();
      else if (part.type === "text") {
        // Text after a tool call belongs to the next model call.
        if (calls.length) flush();
        text += part.text;
      } else if (isToolPart(part)) {
        if (part.state !== "output-available" && part.state !== "output-error") continue;
        calls.push({
          id: part.toolCallId,
          type: "function",
          function: { name: toolName(part), arguments: JSON.stringify(part.input ?? {}) },
        });
        results.push(
          part.state === "output-available"
            ? {
                id: `${part.toolCallId}-result`,
                role: "tool",
                toolCallId: part.toolCallId,
                content: JSON.stringify(part.output ?? null),
              }
            : {
                id: `${part.toolCallId}-result`,
                role: "tool",
                toolCallId: part.toolCallId,
                content: part.errorText,
                error: part.errorText,
              },
        );
      }
    }
    flush();
  }
  return out;
}

// --- Response: AG-UI events → AI SDK chunks ---------------------------------

/** Splits a server-sent event stream into the JSON of each `data:` field. */
export function serverSentEvents() {
  let buffer = "";
  const parse = (block: string, controller: TransformStreamDefaultController<AGUIEvent>) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data) controller.enqueue(JSON.parse(data) as AGUIEvent);
  };
  return new TransformStream<string, AGUIEvent>({
    transform(text, controller) {
      buffer += text;
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) parse(block, controller);
    },
    flush(controller) {
      parse(buffer, controller);
    },
  });
}

const FINISH_REASONS: Record<string, FinishReason> = {
  stop: "stop",
  length: "length",
  content_filter: "content-filter",
  tool_calls: "tool-calls",
};

/** A tool result as the AI SDK should show it: parsed JSON when it is JSON. */
function toolOutput(content: ToolCallResultEvent["content"]): unknown {
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

/**
 * Turns one AG-UI run into one AI SDK assistant message.
 *
 * TanStack AI sends `RUN_FINISHED` after every model call in its agent loop,
 * not only at the end, so it marks the end of a step here; the message
 * finishes when the stream closes. Part ids are made unique per stream,
 * because the server may reuse a message id across steps. The `*_CHUNK`
 * shorthand events, which TanStack AI doesn't send, are ignored.
 */
export function agUiToUIMessageChunks() {
  let started = false;
  let stepOpen = false;
  let finishReason: FinishReason | undefined;
  let counter = 0;
  const openParts = new Map<string, { id: string; kind: "text" | "reasoning" }>();
  const toolArgs = new Map<string, { name: string; args: string }>();

  return new TransformStream<AGUIEvent, UIMessageChunk>({
    transform(event, controller) {
      const emit = (chunk: UIMessageChunk) => controller.enqueue(chunk);
      const ensureStep = () => {
        if (!started) {
          emit({ type: "start" });
          started = true;
        }
        if (!stepOpen) {
          emit({ type: "start-step" });
          stepOpen = true;
        }
      };
      const startPart = (key: string, kind: "text" | "reasoning") => {
        ensureStep();
        const id = `${kind}-${++counter}`;
        openParts.set(key, { id, kind });
        emit({ type: kind === "text" ? "text-start" : "reasoning-start", id });
        return id;
      };
      /** The open part's id, starting the part if a delta came without a start. */
      const partId = (key: string, kind: "text" | "reasoning") =>
        openParts.get(key)?.id ?? startPart(key, kind);
      const endPart = (key: string) => {
        const part = openParts.get(key);
        if (!part) return;
        openParts.delete(key);
        emit({ type: part.kind === "text" ? "text-end" : "reasoning-end", id: part.id });
      };

      switch (event.type) {
        case EventType.RUN_STARTED:
          ensureStep();
          break;
        case EventType.TEXT_MESSAGE_START:
          startPart(`text:${event.messageId}`, "text");
          break;
        case EventType.TEXT_MESSAGE_CONTENT: {
          const key = `text:${event.messageId}`;
          emit({ type: "text-delta", id: partId(key, "text"), delta: event.delta });
          break;
        }
        case EventType.TEXT_MESSAGE_END:
          endPart(`text:${event.messageId}`);
          break;
        case EventType.REASONING_MESSAGE_START:
          startPart(`reasoning:${event.messageId}`, "reasoning");
          break;
        case EventType.REASONING_MESSAGE_CONTENT: {
          const key = `reasoning:${event.messageId}`;
          emit({ type: "reasoning-delta", id: partId(key, "reasoning"), delta: event.delta });
          break;
        }
        case EventType.REASONING_MESSAGE_END:
          endPart(`reasoning:${event.messageId}`);
          break;
        case EventType.TOOL_CALL_START:
          ensureStep();
          toolArgs.set(event.toolCallId, { name: event.toolCallName, args: "" });
          emit({
            type: "tool-input-start",
            toolCallId: event.toolCallId,
            toolName: event.toolCallName,
            dynamic: true,
          });
          break;
        case EventType.TOOL_CALL_ARGS: {
          const call = toolArgs.get(event.toolCallId);
          if (call) call.args += event.delta;
          emit({
            type: "tool-input-delta",
            toolCallId: event.toolCallId,
            inputTextDelta: event.delta,
          });
          break;
        }
        case EventType.TOOL_CALL_END: {
          const call = toolArgs.get(event.toolCallId);
          const toolName = call?.name ?? "unknown";
          let input: unknown;
          try {
            input = JSON.parse(call?.args || "{}");
          } catch {
            emit({
              type: "tool-input-error",
              toolCallId: event.toolCallId,
              toolName,
              input: call?.args,
              dynamic: true,
              errorText: "The tool arguments were not valid JSON.",
            });
            break;
          }
          emit({
            type: "tool-input-available",
            toolCallId: event.toolCallId,
            toolName,
            input,
            dynamic: true,
          });
          break;
        }
        case EventType.TOOL_CALL_RESULT: {
          emit({
            type: "tool-output-available",
            toolCallId: event.toolCallId,
            output: toolOutput(event.content),
            dynamic: true,
          });
          break;
        }
        case EventType.RUN_FINISHED: {
          // AG-UI has no finish reason; TanStack AI adds one in its metadata.
          const reason: unknown = event.metadata?.tanstack?.finishReason;
          if (typeof reason === "string") finishReason = FINISH_REASONS[reason] ?? "other";
          for (const key of openParts.keys()) endPart(key);
          if (stepOpen) emit({ type: "finish-step" });
          stepOpen = false;
          break;
        }
        case EventType.RUN_ERROR:
          finishReason = "error";
          emit({
            type: "error",
            errorText: event.message || "The agent failed.",
          });
          break;
      }
    },
    flush(controller) {
      for (const part of openParts.values()) {
        controller.enqueue({
          type: part.kind === "text" ? "text-end" : "reasoning-end",
          id: part.id,
        });
      }
      if (stepOpen) controller.enqueue({ type: "finish-step" });
      if (started) controller.enqueue({ type: "finish", finishReason });
    },
  });
}
