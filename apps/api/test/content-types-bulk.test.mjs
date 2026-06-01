import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { ContentTypesService } from "../dist/modules/content-types/content-types.service.js";

function authorization() {
  return { assertSitePermission() {} };
}

test("bulk page actions reject collection content types", async () => {
  const client = {
    contentType: {
      findMany() {
        return [{ id: "ct-collection", kind: "COLLECTION", status: "ACTIVE" }];
      },
    },
  };
  const service = new ContentTypesService({ client }, authorization(), {});

  await assert.rejects(
    service.bulk("u", "site-a", {
      action: "archive",
      ids: ["ct-collection"],
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("bulk publish counts inactive pages as failures without creating content", async () => {
  let resolved = false;
  const client = {
    contentType: {
      findMany() {
        return [{ id: "ct-page", kind: "SINGLE", status: "ARCHIVED" }];
      },
    },
  };
  const entriesService = {
    getOrCreateSingle() {
      resolved = true;
    },
  };
  const service = new ContentTypesService(
    { client },
    authorization(),
    entriesService,
  );

  assert.deepEqual(
    await service.bulk("u", "site-a", {
      action: "publish",
      ids: ["ct-page"],
    }),
    { affected: 0, failed: 1 },
  );
  assert.equal(resolved, false);
});
