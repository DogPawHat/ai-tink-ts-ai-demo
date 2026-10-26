import { Component, Suspense, type ComponentType, type ReactNode } from "react";
import type { ReactFrontendTool, ReactHumanInTheLoop } from "@copilotkit/react-core/v2";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface GenComponentBase<T extends Record<string, unknown>> {
  /** Tool name the model calls. */
  name: string;
  /** What the component is for and when to use it; the model reads this. */
  description: string;
  /** Plain data only: no morphs, `.narrow`, or `Date`, which have no JSON Schema form. */
  schema: StandardSchemaV1<unknown, T>;
  /** Shown while arguments stream in and while the component suspends. */
  skeleton?: ComponentType;
}

/** A component the agent draws; the run continues without waiting. */
export interface GenComponent<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends GenComponentBase<T> {
  interactive?: false;
  render: ComponentType<T>;
}

export interface InteractiveProps<T> {
  args: T;
  /** Sends the user's answer back to the agent; undefined once answered. */
  respond?: (result: unknown) => void;
  /** The answer, once given. */
  result?: string;
}

/** A component that waits for the user and returns their answer to the agent. */
export interface InteractiveGenComponent<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends GenComponentBase<T> {
  interactive: true;
  render: ComponentType<InteractiveProps<T>>;
}

export type AnyGenComponent = GenComponent<any> | InteractiveGenComponent<any>;

export function defineGenComponent<T extends Record<string, unknown>>(
  definition: Omit<GenComponent<T>, "interactive">,
): GenComponent<T> {
  return { ...definition, interactive: false };
}

export function defineInteractiveGenComponent<T extends Record<string, unknown>>(
  definition: Omit<InteractiveGenComponent<T>, "interactive">,
): InteractiveGenComponent<T> {
  return { ...definition, interactive: true };
}

function toolDescription(definition: GenComponentBase<Record<string, unknown>>) {
  return `Displays the "${definition.name}" component in the chat.\n\n${definition.description}`;
}

/** A display component as a CopilotKit frontend tool that renders it. */
export function toFrontendTool<T extends Record<string, unknown>>(
  definition: GenComponent<T>,
): ReactFrontendTool<T> {
  const Render = definition.render;
  return {
    name: definition.name,
    description: toolDescription(definition),
    parameters: definition.schema,
    render: ({ args, status }) => (
      <GenView definition={definition} args={args} streaming={status === "inProgress"}>
        {(value) => <Render {...value} />}
      </GenView>
    ),
  };
}

/** An interactive component as a CopilotKit human-in-the-loop tool. */
export function toHumanInTheLoopTool<T extends Record<string, unknown>>(
  definition: InteractiveGenComponent<T>,
): ReactHumanInTheLoop<T> {
  const Render = definition.render;
  return {
    name: definition.name,
    description: toolDescription(definition),
    parameters: definition.schema,
    render: ({ args, status, respond, result }) => (
      <GenView definition={definition} args={args} streaming={status === "inProgress"}>
        {(value) => (
          <Render
            args={value}
            respond={respond ? (answer) => void respond(answer) : undefined}
            result={result}
          />
        )}
      </GenView>
    ),
  };
}

/**
 * Validates the arguments once for every component. While they stream in, it
 * shows the skeleton; if the finished arguments are invalid, an error card.
 * The same skeleton is the Suspense fallback for data a component loads, and
 * an error boundary keeps one broken component from taking down the chat.
 */
function GenView<T extends Record<string, unknown>>({
  definition,
  args,
  streaming,
  children,
}: {
  definition: GenComponentBase<T>;
  args: Partial<T>;
  streaming: boolean;
  children: (value: T) => ReactNode;
}) {
  const Fallback = definition.skeleton ?? DefaultSkeleton;
  const result = definition.schema["~standard"].validate(args);
  if (result instanceof Promise)
    throw new Error(`${definition.name}: async schemas are not supported`);
  if (result.issues) {
    // Partial arguments fail validation until the required fields arrive.
    if (streaming) return <Fallback />;
    return (
      <ErrorCard title={`Couldn't show ${definition.name}`} detail={formatIssues(result.issues)} />
    );
  }
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <GenErrorBoundary name={definition.name} onReset={reset}>
          <Suspense fallback={<Fallback />}>{children(result.value)}</Suspense>
        </GenErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function formatIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>) {
  return issues
    .map(({ path, message }) => {
      const at = path?.map((key) => (typeof key === "object" ? key.key : key)).join(".");
      return at ? `${at}: ${message}` : message;
    })
    .join("\n");
}

function DefaultSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-1">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function ErrorCard({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      <pre className="mt-1 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
        {detail}
      </pre>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

class GenErrorBoundary extends Component<
  { name: string; onReset: () => void; children: ReactNode },
  { error: Error | undefined }
> {
  state: { error: Error | undefined } = { error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  retry = () => {
    this.props.onReset();
    this.setState({ error: undefined });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <ErrorCard
          title={`${this.props.name} failed`}
          detail={error.message}
          onRetry={this.retry}
        />
      );
    }
    return this.props.children;
  }
}
