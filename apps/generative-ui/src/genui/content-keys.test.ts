import { expect, test } from "vite-plus/test";
import { withContentKeys } from "./content-keys";

test("keys items by their content", () => {
  const keyed = withContentKeys(["a", "b"], (item) => item);
  expect(keyed).toEqual([
    { key: "a", item: "a" },
    { key: "b", item: "b" },
  ]);
});

test("numbers repeated items so keys stay unique", () => {
  const keys = withContentKeys(["a", "b", "a", "a"], (item) => item).map((k) => k.key);
  expect(keys).toEqual(["a", "b", "a#1", "a#2"]);
});
