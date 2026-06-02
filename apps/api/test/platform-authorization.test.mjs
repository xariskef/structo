import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenException } from "@nestjs/common";

import { AuthorizationService } from "../dist/modules/authorization/authorization.service.js";

function createService(access = {}) {
  return new AuthorizationService({
    client: {
      platformOperatorAccess: {
        findUnique({ where }) {
          return access[where.userId] ?? null;
        },
      },
    },
  });
}

test("explicit platform operators are accepted", async () => {
  const service = createService({ "user-op": { role: "PLATFORM_ADMIN" } });

  assert.equal(await service.getPlatformRole("user-op"), "PLATFORM_ADMIN");
  assert.equal(
    await service.assertPlatformOperator("user-op"),
    "PLATFORM_ADMIN",
  );
});

test("organization owners never gain platform access implicitly", async () => {
  const service = createService({});

  assert.equal(await service.getPlatformRole("org-owner"), null);
  await assert.rejects(
    service.assertPlatformOperator("org-owner"),
    ForbiddenException,
  );
});
