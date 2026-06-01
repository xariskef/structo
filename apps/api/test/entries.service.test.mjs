import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { EntriesService } from "../dist/modules/entries/entries.service.js";

const requiredTitleField = {
  id: "title-field",
  type: "text",
  label: "Body title",
  key: "bodyTitle",
  required: true,
  config: {},
};

function createAuthorizationService() {
  return {
    assertSitePermission() {},
  };
}

test("entry creation resolves an active content type inside the requested site", async () => {
  let receivedWhere;
  const service = new EntriesService(
    {
      client: {
        contentType: {
          findFirst({ where }) {
            receivedWhere = where;
            return null;
          },
        },
      },
    },
    createAuthorizationService(),
  );

  await assert.rejects(
    service.create("user-a", "site-a", {
      contentTypeId: "content-type-b",
      title: "Entry",
      slug: "entry",
      data: {},
    }),
    BadRequestException,
  );

  assert.deepEqual(receivedWhere, {
    id: "content-type-b",
    siteId: "site-a",
    status: "ACTIVE",
  });
});

test("draft creation permits missing required dynamic values", async () => {
  let createdData;
  const createdEntry = {
    id: "entry-a",
    siteId: "site-a",
    contentTypeId: "content-type-a",
    contentTypeVersionId: "version-a",
    title: "Draft",
    slug: "draft",
    status: "DRAFT",
    data: {},
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contentType: { name: "Articles" },
    contentTypeVersion: { fields: [requiredTitleField] },
    revisions: [],
  };
  const service = new EntriesService(
    {
      client: {
        contentType: {
          findFirst() {
            return {
              site: { organizationId: "organization-a" },
              versions: [{ id: "version-a", fields: [requiredTitleField] }],
            };
          },
        },
        $transaction(callback) {
          return callback({
            contentEntry: {
              create({ data }) {
                createdData = data;
                return createdEntry;
              },
            },
            auditLog: { create() {} },
          });
        },
      },
    },
    createAuthorizationService(),
  );

  const result = await service.create("user-a", "site-a", {
    contentTypeId: "content-type-a",
    title: "Draft",
    slug: "draft",
    data: {},
  });

  assert.deepEqual(createdData.data, {});
  assert.deepEqual(result.fields, [requiredTitleField]);
});

test("publishing rejects an incomplete draft against its referenced schema version", async () => {
  let updated = false;
  const service = new EntriesService(
    {
      client: {
        contentEntry: {
          findUnique() {
            return {
              id: "entry-a",
              siteId: "site-a",
              status: "DRAFT",
              data: {},
              contentTypeId: "content-type-a",
              contentTypeVersion: { fields: [requiredTitleField] },
              site: { organizationId: "organization-a" },
              revisions: [],
            };
          },
          update() {
            updated = true;
          },
        },
        // No newer active version: publish falls back to the entry's bound
        // schema version.
        contentType: {
          findFirst() {
            return null;
          },
        },
      },
    },
    createAuthorizationService(),
  );

  await assert.rejects(
    service.publish("user-a", "site-a", "entry-a"),
    BadRequestException,
  );
  assert.equal(updated, false);
});
