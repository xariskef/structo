import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException, ConflictException } from "@nestjs/common";

import { EntriesService } from "../dist/modules/entries/entries.service.js";

function authorization() {
  return { assertSitePermission() {} };
}

function singleContentTypeClient(entryCount) {
  let isolationLevel;
  return {
    get isolationLevel() {
      return isolationLevel;
    },
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
    $transaction(callback, options) {
      isolationLevel = options?.isolationLevel;
      return callback({
        contentEntry: {
          count() {
            return entryCount;
          },
          create() {
            throw new Error("Unexpected entry creation.");
          },
        },
        auditLog: {
          create() {
            throw new Error("Unexpected audit log creation.");
          },
        },
      });
    },
  };
}

function entryDetail() {
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
}

test("single pages serialize item creation before rejecting a second item", async () => {
  const client = singleContentTypeClient(1);
  const service = new EntriesService({ client }, authorization());

  await assert.rejects(
    service.create("user-a", "site-a", {
      contentTypeId: "ct-single",
      title: "Duplicate",
      slug: "duplicate",
      data: {},
    }),
    (error) => error instanceof ConflictException,
  );

  assert.equal(client.isolationLevel, "Serializable");
});

test("getOrCreateSingle rejects collections before returning an existing item", async () => {
  let lookedForEntry = false;
  const client = {
    contentType: {
      findFirst() {
        return { kind: "COLLECTION" };
      },
    },
    contentEntry: {
      findFirst() {
        lookedForEntry = true;
        return { id: "entry-1" };
      },
    },
  };
  const service = new EntriesService({ client }, authorization());

  await assert.rejects(
    service.getOrCreateSingle("user-a", "site-a", "ct-collection"),
    (error) => error instanceof BadRequestException,
  );

  assert.equal(lookedForEntry, false);
});

test("getOrCreateSingle returns the existing item without creating another", async () => {
  let created = false;
  const client = {
    contentType: {
      findFirst() {
        return { kind: "SINGLE" };
      },
    },
    contentEntry: {
      findFirst() {
        return { id: "entry-1" };
      },
      findUnique() {
        return entryDetail();
      },
      create() {
        created = true;
        return { id: "entry-2" };
      },
    },
    contentType: {
      findFirst({ where }) {
        // latestActiveVersion (status ACTIVE) → no newer version.
        if (where.status === "ACTIVE") return null;
        // getOrCreateSingle kind check.
        return { kind: "SINGLE" };
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

test("single page content is archived with its page, not as an entry", async () => {
  const client = {
    contentEntry: {
      findUnique() {
        return {
          ...entryDetail(),
          contentType: { kind: "SINGLE" },
          site: { organizationId: "org-a" },
        };
      },
    },
  };
  const service = new EntriesService({ client }, authorization());

  await assert.rejects(
    service.archive("user-a", "site-a", "entry-1"),
    (error) => error instanceof BadRequestException,
  );
});

test("single page content cannot be hard deleted as an entry", async () => {
  let deleted = false;
  const client = {
    contentEntry: {
      findUnique() {
        return {
          ...entryDetail(),
          contentType: { kind: "SINGLE" },
          site: { organizationId: "org-a" },
        };
      },
      delete() {
        deleted = true;
      },
    },
  };
  const service = new EntriesService({ client }, authorization());

  await assert.rejects(
    service.remove("user-a", "site-a", "entry-1"),
    (error) => error instanceof BadRequestException,
  );
  assert.equal(deleted, false);
});
