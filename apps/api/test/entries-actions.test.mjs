import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  bulkEntriesSchema,
  entryStatusSchema,
  scheduleEntrySchema,
} from "@structo/contracts";
import { EntriesService } from "../dist/modules/entries/entries.service.js";

function authorization() {
  return { assertSitePermission() {} };
}

test("bulkEntriesSchema validates actions and ids", () => {
  assert.ok(
    bulkEntriesSchema.safeParse({ action: "publish", entryIds: ["a"] }).success,
  );
  assert.ok(
    !bulkEntriesSchema.safeParse({ action: "nope", entryIds: ["a"] }).success,
  );
  assert.ok(
    !bulkEntriesSchema.safeParse({ action: "delete", entryIds: [] }).success,
  );
});

test("scheduleEntrySchema accepts an ISO datetime", () => {
  assert.ok(
    scheduleEntrySchema.safeParse({ publishAt: "2030-01-01T10:00:00.000Z" })
      .success,
  );
  assert.ok(
    !scheduleEntrySchema.safeParse({ publishAt: "not-a-date" }).success,
  );
  assert.ok(
    !scheduleEntrySchema.safeParse({ publishAt: "January 1, 2030" }).success,
  );
});

test("entryStatusSchema rejects unknown status filters", () => {
  assert.ok(entryStatusSchema.safeParse("SCHEDULED").success);
  assert.ok(!entryStatusSchema.safeParse("unknown").success);
});

test("schedule rejects a past date", async () => {
  const service = new EntriesService({ client: {} }, authorization());
  await assert.rejects(
    service.schedule("u", "site-a", "e1", {
      publishAt: "2000-01-01T00:00:00.000Z",
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("bulk rejects ids that do not belong to the site", async () => {
  const client = {
    contentEntry: {
      // Only one of the two requested ids is owned by the site.
      findMany() {
        return [{ id: "e1" }];
      },
    },
  };
  const service = new EntriesService({ client }, authorization());
  await assert.rejects(
    service.bulk("u", "site-a", {
      action: "publish",
      entryIds: ["e1", "e2"],
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("get surfaces fields added in a newer active version", async () => {
  // The entry is bound to v1 (one field) but the content type's active version
  // is v2 (two fields). The editor must see the v2 fields.
  const fieldA = {
    id: "f1",
    type: "text",
    label: "A",
    key: "a",
    required: false,
    config: {},
  };
  const fieldB = {
    id: "f2",
    type: "text",
    label: "B",
    key: "b",
    required: false,
    config: {},
  };
  const client = {
    contentEntry: {
      findUnique() {
        return {
          id: "e1",
          siteId: "site-a",
          contentTypeId: "ct1",
          contentTypeVersionId: "v1",
          title: "Item",
          slug: "item",
          status: "DRAFT",
          data: {},
          excerpt: null,
          seoTitle: null,
          seoDescription: null,
          publishedAt: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          contentType: { name: "Posts", kind: "COLLECTION", slug: "posts" },
          contentTypeVersion: { fields: [fieldA] },
          revisions: [],
        };
      },
    },
    contentType: {
      findFirst() {
        return { versions: [{ id: "v2", fields: [fieldA, fieldB] }] };
      },
    },
  };

  const service = new EntriesService({ client }, authorization());
  const result = await service.get("u", "site-a", "e1");
  assert.equal(result.fields.length, 2);
  assert.ok(result.fields.some((f) => f.key === "b"));
});

test("duplicate creates a DRAFT copy with a unique slug", async () => {
  let createdData;
  const client = {
    contentEntry: {
      findUnique() {
        return {
          id: "e1",
          siteId: "site-a",
          slug: "hello",
          title: "Hello",
          data: { a: 1 },
          excerpt: "x",
          seoTitle: null,
          seoDescription: null,
          contentTypeId: "ct1",
          contentTypeVersionId: "v1",
          site: { organizationId: "org" },
          contentType: { kind: "COLLECTION" },
        };
      },
      // "hello-copy" already exists; "hello-copy-2" is free.
      findFirst({ where }) {
        return where.slug === "hello-copy" ? { id: "taken" } : null;
      },
    },
    $transaction(callback) {
      const tx = {
        contentEntry: {
          create(args) {
            createdData = args.data;
            return {
              ...args.data,
              id: "e2",
              publishedAt: null,
              createdAt: new Date(0),
              updatedAt: new Date(0),
              contentType: { name: "Post", kind: "COLLECTION", slug: "posts" },
              contentTypeVersion: { fields: [] },
            };
          },
        },
        auditLog: { create() {} },
      };
      return callback(tx);
    },
  };

  const service = new EntriesService({ client }, authorization());
  const result = await service.duplicate("u", "site-a", "e1");

  assert.equal(createdData.title, "Hello (copy)");
  assert.equal(createdData.slug, "hello-copy-2");
  assert.equal(createdData.status, "DRAFT");
  assert.equal(result.status, "DRAFT");
});

test("update prunes removed keys when migrating to the current schema", async () => {
  const keep = {
    id: "f1",
    type: "text",
    label: "Keep",
    key: "keep",
    required: false,
    config: {},
  };
  const group = {
    id: "f2",
    type: "group",
    label: "Group",
    key: "group",
    required: false,
    config: { fields: [keep] },
  };
  let updatedData;
  const client = {
    contentEntry: {
      findUnique() {
        return {
          id: "e1",
          siteId: "site-a",
          contentTypeId: "ct1",
          contentTypeVersionId: "v1",
          status: "DRAFT",
          contentTypeVersion: { fields: [] },
          site: { organizationId: "org" },
        };
      },
      update({ data }) {
        updatedData = data.data;
        return {};
      },
    },
    contentType: {
      findFirst() {
        return { versions: [{ id: "v2", fields: [keep, group] }] };
      },
    },
    auditLog: {
      create() {
        return {};
      },
    },
    $transaction(values) {
      return Promise.all(values);
    },
  };
  const service = new EntriesService({ client }, authorization());
  service.get = async () => ({});

  await service.update("u", "site-a", "e1", {
    data: {
      keep: "yes",
      removed: "old",
      group: { keep: "nested", removed: "old nested" },
    },
  });

  assert.deepEqual(updatedData, {
    keep: "yes",
    group: { keep: "nested" },
  });
});

test("scheduled promotion creates a revision and an audit event", async () => {
  let revisionData;
  let auditData;
  const client = {
    contentEntry: {
      findMany() {
        return [{ id: "e1" }];
      },
    },
    $transaction(callback) {
      return callback({
        contentEntry: {
          updateMany() {
            return { count: 1 };
          },
          update() {},
          findUnique() {
            return {
              siteId: "site-a",
              title: "Hello",
              slug: "hello",
              excerpt: null,
              seoTitle: null,
              seoDescription: null,
              data: { content: "<p>Hello</p>" },
              site: { organizationId: "org" },
              revisions: [{ revision: 2 }],
              taxonomyTerms: [],
            };
          },
        },
        contentRevision: {
          create({ data }) {
            revisionData = data;
            return { id: "rev-new" };
          },
        },
        auditLog: {
          create({ data }) {
            auditData = data;
          },
        },
      });
    },
  };
  const service = new EntriesService({ client }, authorization());

  assert.equal(await service.promoteDueScheduled(), 1);
  assert.equal(revisionData.revision, 3);
  assert.equal(revisionData.status, "PUBLISHED");
  assert.equal(revisionData.createdById, null);
  assert.equal(revisionData.title, "Hello");
  assert.equal(revisionData.slug, "hello");
  assert.equal(auditData.action, "entry.publish_scheduled");
  assert.equal(auditData.actorId, null);
});
