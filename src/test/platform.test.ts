import assert from "node:assert/strict";
import test from "node:test";
import { isCodespace } from "../platform";

test("detects Codespaces from the environment", () => {
  assert.equal(isCodespace({ CODESPACES: "true" }), true);
});

test("detects Codespaces from the VS Code remote name", () => {
  assert.equal(isCodespace({}, "codespaces"), true);
});

test("rejects a local environment", () => {
  assert.equal(isCodespace({ CODESPACES: "false" }, undefined), false);
});
