import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activatableContentTypeFieldsSchema,
  contentTypeKindSchema,
  createContentTypeSchema,
} from "@structo/contracts";
import { createField } from "@structo/field-kit";

describe("content type kind", () => {
  it("accepts COLLECTION and SINGLE", () => {
    assert.ok(contentTypeKindSchema.safeParse("COLLECTION").success);
    assert.ok(contentTypeKindSchema.safeParse("SINGLE").success);
    assert.ok(!contentTypeKindSchema.safeParse("OTHER").success);
  });

  it("defaults kind to COLLECTION when omitted", () => {
    const result = createContentTypeSchema.safeParse({
      name: "Articles",
      slug: "articles",
    });
    assert.ok(result.success, JSON.stringify(result.error));
    assert.equal(result.data.kind, "COLLECTION");
  });

  it("accepts singular and plural names for a collection", () => {
    const result = createContentTypeSchema.safeParse({
      kind: "COLLECTION",
      name: "Articles",
      singularName: "Article",
      pluralName: "Articles",
      slug: "articles",
    });
    assert.ok(result.success, JSON.stringify(result.error));
    assert.equal(result.data.singularName, "Article");
    assert.equal(result.data.pluralName, "Articles");
  });

  it("accepts a single page kind", () => {
    const result = createContentTypeSchema.safeParse({
      kind: "SINGLE",
      name: "About",
      slug: "about",
    });
    assert.ok(result.success, JSON.stringify(result.error));
    assert.equal(result.data.kind, "SINGLE");
  });
});

describe("default seeded content field", () => {
  it("creates a richText 'content' field that is activatable", () => {
    const field = createField("richText", "Content", "content");
    assert.equal(field.type, "richText");
    assert.equal(field.key, "content");

    // The auto-seeded body must satisfy the activation schema so a brand-new
    // content type can be activated immediately.
    const result = activatableContentTypeFieldsSchema.safeParse([field]);
    assert.ok(result.success, JSON.stringify(result.error));
  });
});
