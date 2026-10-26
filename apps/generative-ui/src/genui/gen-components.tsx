import { useFrontendTools, useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { toFrontendTool, toHumanInTheLoopTool, type AnyGenComponent } from "./define";

// Every file in ./components registers itself; adding a component is adding a file.
const modules = import.meta.glob<{ default: AnyGenComponent }>("./components/*.tsx", {
  eager: true,
});

export const genComponents = Object.values(modules).map((module) => module.default);

const displayTools = genComponents.flatMap((c) => (c.interactive ? [] : [toFrontendTool(c)]));
const interactiveTools = genComponents.flatMap((c) =>
  c.interactive ? [toHumanInTheLoopTool(c)] : [],
);

function InteractiveTool({ tool }: { tool: ReturnType<typeof toHumanInTheLoopTool> }) {
  useHumanInTheLoop(tool);
  return null;
}

export function GenComponents() {
  useFrontendTools(displayTools);
  return interactiveTools.map((tool) => <InteractiveTool key={tool.name} tool={tool} />);
}
