import assert from "node:assert/strict";
import { test } from "node:test";

import { ConflictException } from "@nestjs/common";

import { EntriesService } from "../dist/modules/entries/entries.service.js";

function authorization() {
  return { assertSitePermission() {} };
}

function singleContentTypeClient(entryCount) {
  return {
    contentType: {
      findFirst() {
        return {
          id: "ct-single",
          kind: "SINGLE",
          name: "About",
          slug: "about",
          site: { organizationId: "org-a" },
          versions: [{ id: "ver-1", fields: [] }],
        };
      },
    },
    contentEntry: {
      count() {
        return entryCount;
      },
    },
  };
}

test("single pages reject a second item", async () => {
  const service = new EntriesService(
    { client: singleContentTypeClient(1) },
    authorization(),
  );

  await assert.rejects(
    service.create("user-a", "site-a", {
      contentTypeId: "ct-single",
      title: "Duplicate",
      slug: "duplicate",
      data: {},
    }),
    (error) => error instanceof ConflictException,
  );
});

test("getOrCreateSingle returns the existing item without creating another", async () => {
  let created = false;
  const client = {
    contentEntry: {
      findFirst() {
        return { id: "entry-1" };
      },
      findUnique() {
        return {
          id: "entry-1",
          siteId: "site-a",
          contentTypeId: "ct-single",
          contentTypeVersionId: "ver-1",
          title: "About",
          slug: "about",
          status: "DRAFT",
          data: {},
          publishedAt: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          contentType: { name: "About" },
          contentTypeVersion: { fields: [] },
          revisions: [],
        };
      },
      create() {
        created = true;
        return { id: "entry-2" };
      },
    },
  };

  const service = new EntriesService({ client }, authorization());
  const result = await service.getOrCreateSingle(
    "user-a",
    "site-a",
    "ct-single",
  );

  assert.equal(result.id, "entry-1");
  assert.equal(created, false);
});
