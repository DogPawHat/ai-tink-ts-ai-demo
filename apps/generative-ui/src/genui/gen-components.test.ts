import { expect, test } from "vite-plus/test";
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import { genComponents } from "./gen-components";

test("loads every component in the folder", () => {
  expect(genComponents.map((c) => c.name).sort()).toEqual([
    "callout",
    "cardGrid",
    "chart",
    "choicePicker",
    "dataTable",
    "statRow",
    "timeline",
  ]);
});

test.each(genComponents.map((c) => [c.name, c] as const))(
  "%s's schema converts to JSON Schema",
  (_name, component) => {
    // The model only sees JSON Schema, so morphs and narrows must not hide in a schema.
    const schema = component.schema as unknown as StandardJSONSchemaV1;
    const json = schema["~standard"].jsonSchema.input({ target: "draft-07" });
    expect(json).toMatchObject({ type: "object" });
    expect(Object.keys(json.properties as object).length).toBeGreaterThan(0);
  },
);

test("component names are unique", () => {
  const names = genComponents.map((c) => c.name);
  expect(new Set(names).size).toBe(names.length);
});
