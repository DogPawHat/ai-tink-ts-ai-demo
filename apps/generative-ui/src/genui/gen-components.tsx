import { useFrontendTools } from "@copilotkit/react-core/v2";
import { toFrontendTool, type GenComponent } from "./define";

// Every file in ./components registers itself; adding a component is adding a file.
const modules = import.meta.glob<{ default: GenComponent<any> }>("./components/*.tsx", {
  eager: true,
});

export const genComponents = Object.values(modules).map((module) => module.default);

const tools = genComponents.map(toFrontendTool);

export function GenComponents() {
  useFrontendTools(tools);
  return null;
}
