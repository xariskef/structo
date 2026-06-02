import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createSiteApiTokenSchema,
  deliveryContentTypeSchema,
  deliveryEntriesQuerySchema,
  deliveryEntrySchema,
  deliveryListSchema,
  deliveryMenuSchema,
  deliverySiteSchema,
  siteApiTokenCreatedSchema,
  siteApiTokenSummarySchema,
} from "@structo/contracts";
import { z } from "zod";

describe("delivery contracts", () => {
  it("coerces pagination and applies defaults", () => {
    assert.deepEqual(deliveryEntriesQuerySchema.parse({ page: "2" }), {
      page: 2,
      pageSize: 20,
      sort: "publishedAt:desc",
    });
  });

  it("rejects oversized pages and unknown sorts", () => {
    assert.ok(!deliveryEntriesQuerySchema.safeParse({ pageSize: 101 }).success);
    assert.ok(
      !deliveryEntriesQuerySchema.safeParse({ sort: "createdAt:desc" }).success,
    );
  });

  it("validates token creation input", () => {
    assert.ok(createSiteApiTokenSchema.safeParse({ name: "Frontend" }).success);
    assert.ok(
      !createSiteApiTokenSchema.safeParse({
        name: "Frontend",
        expiresAt: "tomorrow",
      }).success,
    );
  });

  it("generates JSON schemas including recursive navigation menus", () => {
    const schemas = [
      siteApiTokenSummarySchema,
      siteApiTokenCreatedSchema,
      deliverySiteSchema,
      deliveryContentTypeSchema,
      deliveryEntrySchema,
      deliveryListSchema(deliveryEntrySchema),
      deliveryMenuSchema,
    ];
    for (const schema of schemas) {
      assert.ok(z.toJSONSchema(schema));
    }
  });
});
