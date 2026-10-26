import { Component, Suspense, type ComponentType, type ReactNode } from "react";
import type { ReactFrontendTool } from "@copilotkit/react-core/v2";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Skeleton } from "@/components/ui/skeleton";

export interface GenComponent<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Tool name the model calls. */
  name: string;
  /** What the component is for and when to use it; the model reads this. */
  description: string;
  /** Plain data only: no morphs, `.narrow`, or `Date`, which have no JSON Schema form. */
  schema: StandardSchemaV1<unknown, T>;
  render: ComponentType<T>;
  /** Shown while arguments stream in and while the component suspends. */
  skeleton?: ComponentType;
}

export function defineGenComponent<T extends Record<string, unknown>>(
  definition: GenComponent<T>,
): GenComponent<T> {
  return definition;
}

/** Turns a component definition into a CopilotKit frontend tool that renders it. */
export function toFrontendTool<T extends Record<string, unknown>>(
  definition: GenComponent<T>,
): ReactFrontendTool<T> {
  return {
    name: definition.name,
    description: `Displays the "${definition.name}" component in the chat.\n\n${definition.description}`,
    parameters: definition.schema,
    render: ({ args, status }) => (
      <GenView definition={definition} args={args} streaming={status === "inProgress"} />
    ),
  };
}

function GenView<T extends Record<string, unknown>>({
  definition,
  args,
  streaming,
}: {
  definition: GenComponent<T>;
  args: Partial<T>;
  streaming: boolean;
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
  const Render = definition.render as ComponentType<T>;
  return (
    <GenErrorBoundary name={definition.name}>
      <Suspense fallback={<Fallback />}>
        <Render {...result.value} />
      </Suspense>
    </GenErrorBoundary>
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

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
        {detail}
      </pre>
    </div>
  );
}

class GenErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | undefined }
> {
  state = { error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state as { error: Error | undefined };
    if (error) return <ErrorCard title={`${this.props.name} failed`} detail={error.message} />;
    return this.props.children;
  }
}
