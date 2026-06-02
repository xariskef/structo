import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { ApiTokensService } from "../dist/modules/api-tokens/api-tokens.service.js";
import { DeliveryTokenService } from "../dist/modules/delivery/delivery-token.service.js";
import { DeliveryService } from "../dist/modules/delivery/delivery.service.js";
import { getDeliveryOpenApiDocument } from "../dist/modules/delivery/openapi.js";

function authorization() {
  return { assertSitePermission() {} };
}

function crypto() {
  return {
    createToken() {
      return "raw";
    },
    hashToken(token) {
      return `hash:${token}`;
    },
  };
}

function activeContentType() {
  return {
    id: "articles",
    kind: "COLLECTION",
    slug: "articles",
    name: "Article",
    singularName: "Article",
    pluralName: "Articles",
    description: null,
    versions: [{ fields: [] }],
    taxonomies: [{ taxonomy: "CATEGORY" }, { taxonomy: "TAG" }],
  };
}

function publishedEntry() {
  return {
    publishedAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-01T11:00:00.000Z"),
    publishedRevision: {
      title: "Hello",
      slug: "hello",
      data: {},
      excerpt: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: new Date("2026-06-01T10:00:00.000Z"),
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      contentTypeVersion: { fields: [] },
      terms: [{ kind: "CATEGORY", name: "News", slug: "news" }],
    },
  };
}

test("delivery OpenAPI document is generated as OpenAPI 3.1", () => {
  const document = getDeliveryOpenApiDocument();
  assert.equal(document.openapi, "3.1.0");
  assert.ok(
    document.paths["/sites/{siteKey}/content-types/{typeSlug}/entries"],
  );
  assert.ok(document.components.schemas.DeliveryMenu);
});

test("delivery lists published entries with pagination and taxonomy filters", async () => {
  let capturedWhere;
  let capturedOrderBy;
  const client = {
    contentType: {
      findFirst() {
        return activeContentType();
      },
    },
    contentEntry: {
      findMany({ where, orderBy }) {
        capturedWhere = where;
        capturedOrderBy = orderBy;
        return [publishedEntry()];
      },
      count() {
        return 1;
      },
    },
    $transaction(values) {
      return Promise.all(values);
    },
  };
  const service = new DeliveryService({ client });

  const result = await service.listEntries("site-a", "articles", {
    page: 2,
    pageSize: 10,
    sort: "title:asc",
    category: "news",
    tag: "featured",
  });

  assert.equal(capturedWhere.status, undefined);
  assert.deepEqual(capturedWhere.publishedRevisionId, { not: null });
  assert.deepEqual(capturedOrderBy, {
    publishedRevision: { title: "asc" },
  });
  assert.equal(
    capturedWhere.AND[0].publishedRevision.terms.some.kind,
    "CATEGORY",
  );
  assert.equal(capturedWhere.AND[1].publishedRevision.terms.some.kind, "TAG");
  assert.deepEqual(result.meta, {
    page: 2,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  });
  assert.equal(result.data[0].terms[0].slug, "news");
});

test("delivery sanitizes declared rich-text fields before returning entries", async () => {
  const client = {
    contentType: {
      findFirst() {
        return {
          ...activeContentType(),
          versions: [
            {
              fields: [
                {
                  id: "content",
                  type: "richText",
                  key: "content",
                  label: "Content",
                  required: true,
                  config: {},
                },
              ],
            },
          ],
        };
      },
    },
    contentEntry: {
      findFirst() {
        return {
          ...publishedEntry(),
          publishedRevision: {
            ...publishedEntry().publishedRevision,
            data: {
              content: '<p onclick="bad()">Safe<script>bad()</script></p>',
            },
            contentTypeVersion: {
              fields: [
                {
                  id: "content",
                  type: "richText",
                  key: "content",
                  label: "Content",
                  required: true,
                  config: {},
                },
              ],
            },
          },
        };
      },
    },
  };
  const service = new DeliveryService({ client });

  const entry = await service.getEntry("site-a", "articles", "hello");

  assert.deepEqual(entry.data, { content: "<p>Safe</p>" });
});

test("delivery expands media ids into public media objects", async () => {
  const client = {
    contentType: {
      findFirst() {
        return {
          ...activeContentType(),
          versions: [
            {
              fields: [
                {
                  id: "hero",
                  type: "media",
                  key: "hero",
                  label: "Hero",
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        };
      },
    },
    contentEntry: {
      findFirst() {
        return {
          ...publishedEntry(),
          publishedRevision: {
            ...publishedEntry().publishedRevision,
            data: { hero: "asset-a" },
            contentTypeVersion: {
              fields: [
                {
                  id: "hero",
                  type: "media",
                  key: "hero",
                  label: "Hero",
                  required: false,
                  config: {},
                },
              ],
            },
          },
        };
      },
    },
    mediaAsset: {
      findMany() {
        return [
          {
            id: "asset-a",
            url: "https://media.example.com/hero.png",
            filename: "hero.png",
            mimeType: "image/png",
            size: 123,
            width: 1200,
            height: 630,
            alt: "Hero",
            caption: null,
          },
        ];
      },
    },
  };
  const service = new DeliveryService({ client });

  const entry = await service.getEntry("site-a", "articles", "hello");

  assert.deepEqual(entry.data.hero, {
    id: "asset-a",
    url: "https://media.example.com/hero.png",
    filename: "hero.png",
    mimeType: "image/png",
    size: 123,
    width: 1200,
    height: 630,
    alt: "Hero",
    caption: null,
  });
});

test("delivery entry lookup rejects missing or unpublished entries", async () => {
  const client = {
    contentType: { findFirst: activeContentType },
    contentEntry: {
      findFirst() {
        return null;
      },
    },
  };
  const service = new DeliveryService({ client });

  await assert.rejects(
    service.getEntry("site-a", "articles", "draft"),
    (error) => error instanceof NotFoundException,
  );
});

test("delivery token resolver accepts active scoped tokens", async () => {
  const client = {
    siteApiToken: {
      findUnique() {
        return {
          id: "token-a",
          revokedAt: null,
          expiresAt: null,
          scopes: ["content:read"],
          site: { id: "site-a", key: "site_key", status: "ACTIVE" },
        };
      },
    },
  };
  const service = new DeliveryTokenService({ client }, crypto());

  assert.deepEqual(await service.resolve("stk_value"), {
    token: { id: "token-a" },
    site: { id: "site-a", key: "site_key" },
  });
});

test("delivery token resolver rejects revoked, expired and bad-scope tokens", async () => {
  for (const token of [
    { revokedAt: new Date(), expiresAt: null, scopes: ["content:read"] },
    {
      revokedAt: null,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      scopes: ["content:read"],
    },
    { revokedAt: null, expiresAt: null, scopes: ["other"] },
  ]) {
    const client = {
      siteApiToken: {
        findUnique() {
          return {
            id: "token-a",
            ...token,
            site: { id: "site-a", key: "site_key", status: "ACTIVE" },
          };
        },
      },
    };
    const service = new DeliveryTokenService({ client }, crypto());
    await assert.rejects(
      service.resolve("stk_value"),
      (error) => error instanceof UnauthorizedException,
    );
  }
});

test("delivery token resolver rejects archived sites", async () => {
  const client = {
    siteApiToken: {
      findUnique() {
        return {
          id: "token-a",
          revokedAt: null,
          expiresAt: null,
          scopes: ["content:read"],
          site: { id: "site-a", key: "site_key", status: "ARCHIVED" },
        };
      },
    },
  };
  const service = new DeliveryTokenService({ client }, crypto());

  await assert.rejects(
    service.resolve("stk_value"),
    (error) => error instanceof UnauthorizedException,
  );
});

test("API token creation stores only the hash and reveals the raw token once", async () => {
  let createData;
  const now = new Date("2026-06-01T10:00:00.000Z");
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    $transaction(callback) {
      return callback({
        siteApiToken: {
          create({ data }) {
            createData = data;
            return {
              id: "token-a",
              name: data.name,
              scopes: data.scopes,
              lastUsedAt: null,
              expiresAt: null,
              revokedAt: null,
              createdAt: now,
            };
          },
        },
        auditLog: { create() {} },
      });
    },
  };
  const service = new ApiTokensService({ client }, authorization(), crypto());

  const created = await service.create("u", "site-a", { name: "Frontend" });

  assert.equal(createData.tokenHash, "hash:stk_raw");
  assert.equal(created.token, "stk_raw");
  assert.ok(!("tokenHash" in created));
});

test("API token creation rejects an expiry in the past", async () => {
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
  };
  const service = new ApiTokensService({ client }, authorization(), crypto());

  await assert.rejects(
    service.create("u", "site-a", {
      name: "Expired",
      expiresAt: "2020-01-01T00:00:00.000Z",
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("API token revoke rejects cross-site token ids", async () => {
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    siteApiToken: {
      findUnique() {
        return { id: "token-a", siteId: "site-b" };
      },
    },
  };
  const service = new ApiTokensService({ client }, authorization(), crypto());

  await assert.rejects(
    service.revoke("u", "site-a", "token-a"),
    (error) => error instanceof NotFoundException,
  );
});

test("API token revoke persists revokedAt", async () => {
  let updateData;
  let auditData;
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    siteApiToken: {
      findUnique() {
        return { id: "token-a", siteId: "site-a", name: "Frontend" };
      },
      update({ data }) {
        updateData = data;
        return {};
      },
    },
    auditLog: {
      create({ data }) {
        auditData = data;
        return {};
      },
    },
    $transaction(values) {
      return Promise.all(values);
    },
  };
  const service = new ApiTokensService({ client }, authorization(), crypto());

  await service.revoke("u", "site-a", "token-a");

  assert.ok(updateData.revokedAt instanceof Date);
  assert.equal(auditData.action, "api_token.revoke");
});

// ---------------------------------------------------------------------------
// Regression: draft edits must never reach the Delivery API
// ---------------------------------------------------------------------------

test("delivery returns snapshot data — not the live draft — after entry is edited without republishing", async () => {
  // Simulates the state where:
  //   1. Entry was published with title "Original" and body "Original body"
  //   2. Editor then updated the draft to "Updated draft" (not re-published)
  //
  // The Delivery API must still return the published snapshot ("Original")
  // and NOT the draft values ("Updated draft").

  const snapshotData = { body: "Original body" };
  const draftData = { body: "Updated draft" };

  const client = {
    contentType: {
      findFirst() {
        return activeContentType();
      },
    },
    contentEntry: {
      findFirst() {
        // entry.data is the draft (edited but not published)
        // publishedRevision is the frozen snapshot from last publish
        return {
          publishedAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-02T09:00:00.000Z"),
          data: draftData, // should NOT be used by delivery
          title: "Updated draft title", // should NOT be used by delivery
          slug: "original-slug", // should NOT be used by delivery
          publishedRevision: {
            title: "Original",
            slug: "original-slug",
            data: snapshotData,
            excerpt: null,
            seoTitle: null,
            seoDescription: null,
            publishedAt: new Date("2026-06-01T10:00:00.000Z"),
            createdAt: new Date("2026-06-01T10:00:00.000Z"),
            contentTypeVersion: { fields: [] },
            terms: [],
          },
        };
      },
    },
  };

  const service = new DeliveryService({ client });
  const entry = await service.getEntry("site-a", "articles", "original-slug");

  assert.equal(entry.title, "Original", "title must come from snapshot");
  assert.deepEqual(
    entry.data,
    snapshotData,
    "data must come from snapshot, not from draft",
  );
  assert.notDeepEqual(
    entry.data,
    draftData,
    "draft data must not leak into delivery response",
  );
  assert.equal(
    entry.updatedAt,
    "2026-06-01T10:00:00.000Z",
    "updatedAt must come from the snapshot, not the draft",
  );
});

test("delivery menu item URLs use the published snapshot slug", async () => {
  let capturedWhere;
  const client = {
    navigationMenu: {
      findUnique() {
        return {
          key: "main",
          name: "Main",
          items: [
            {
              label: "Hello",
              url: "/fallback",
              target: "_self",
              reference: { kind: "collectionItem", id: "entry-1" },
            },
          ],
        };
      },
    },
    contentEntry: {
      findFirst({ where }) {
        capturedWhere = where;
        return {
          contentType: { slug: "articles" },
          publishedRevision: { slug: "published-slug" },
        };
      },
    },
  };

  const service = new DeliveryService({ client });
  const menu = await service.getMenu("site-a", "main");

  assert.deepEqual(capturedWhere.publishedRevisionId, { not: null });
  assert.equal(capturedWhere.status, undefined);
  assert.equal(menu.items[0].url, "/articles/published-slug");
});

test("delivery returns null for entry with no published revision", async () => {
  // An entry that is PUBLISHED but whose publishedRevisionId was cleared
  // (e.g., edge case or data inconsistency) should raise NotFoundException,
  // not expose draft data.
  const client = {
    contentType: {
      findFirst() {
        return activeContentType();
      },
    },
    contentEntry: {
      findFirst() {
        return {
          publishedAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-01T11:00:00.000Z"),
          publishedRevision: null, // no snapshot
        };
      },
    },
  };

  const service = new DeliveryService({ client });

  await assert.rejects(
    service.getEntry("site-a", "articles", "broken-slug"),
    (error) => error instanceof NotFoundException,
  );
});
