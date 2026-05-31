import assert from "node:assert/strict";
import { test } from "node:test";

import { HealthController } from "../dist/modules/health/health.controller.js";

test("health controller reports the API service as available", () => {
  const controller = new HealthController();

  assert.deepEqual(controller.getHealth(), {
    service: "structo-api",
    status: "ok",
  });
});
