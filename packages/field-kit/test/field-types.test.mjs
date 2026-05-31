import assert from "node:assert/strict";
import { test } from "node:test";

import { FIELD_TYPES } from "../dist/index.js";

test("initial field catalog includes nested structural fields", () => {
  assert.ok(FIELD_TYPES.includes("group"));
  assert.ok(FIELD_TYPES.includes("repeater"));
});
