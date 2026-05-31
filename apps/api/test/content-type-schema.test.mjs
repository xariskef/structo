import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldDefinitionSchema, contentTypeFieldsSchema } from "@structo/contracts";

describe("fieldDefinitionSchema", () => {
  it("accepts a valid text field", () => {
    const result = fieldDefinitionSchema.safeParse({
      id: "field-1",
      type: "text",
      label: "Title",
      key: "title",
      required: true,
      config: { maxLength: 200 },
    });
    assert.ok(result.success, JSON.stringify(result.error));
    assert.equal(result.data.key, "title");
  });

  it("rejects a field with an invalid key", () => {
    const result = fieldDefinitionSchema.safeParse({
      id: "field-1",
      type: "text",
      label: "My Field",
      key: "my-field",
      required: false,
      config: {},
    });
    assert.ok(!result.success, "Expected validation to fail for hyphenated key");
  });

  it("rejects an unknown field type", () => {
    const result = fieldDefinitionSchema.safeParse({
      id: "field-1",
      type: "unknown_type",
      label: "Test",
      key: "test",
      required: false,
      config: {},
    });
    assert.ok(!result.success, "Expected validation to fail for unknown type");
  });

  it("accepts all 18 field types", () => {
    const TYPES = [
      "text", "textarea", "richText", "number", "boolean",
      "select", "multiSelect", "date", "dateTime", "time",
      "url", "email", "color", "media", "gallery",
      "relation", "group", "repeater",
    ];

    for (const type of TYPES) {
      const result = fieldDefinitionSchema.safeParse({
        id: "f",
        type,
        label: "Test",
        key: "test",
        required: false,
        config: {},
      });
      assert.ok(result.success, `Expected type "${type}" to be valid`);
    }
  });
});

describe("contentTypeFieldsSchema", () => {
  it("accepts an empty field array", () => {
    const result = contentTypeFieldsSchema.safeParse([]);
    assert.ok(result.success);
    assert.deepEqual(result.data, []);
  });

  it("accepts a valid array of fields", () => {
    const result = contentTypeFieldsSchema.safeParse([
      { id: "f1", type: "text",   label: "Title", key: "title",   required: true,  config: {} },
      { id: "f2", type: "number", label: "Price", key: "price",   required: false, config: { decimal: true } },
      { id: "f3", type: "select", label: "Status", key: "status", required: false,
        config: { options: [{ label: "Draft", value: "draft" }] } },
    ]);
    assert.ok(result.success, JSON.stringify(result.error));
    assert.equal(result.data.length, 3);
  });

  it("rejects if any field has an invalid key", () => {
    const result = contentTypeFieldsSchema.safeParse([
      { id: "f1", type: "text", label: "Bad Key", key: "bad-key", required: false, config: {} },
    ]);
    assert.ok(!result.success);
  });

  it("accepts a group field with nested fields", () => {
    const result = contentTypeFieldsSchema.safeParse([
      {
        id: "g1",
        type: "group",
        label: "SEO",
        key: "seo",
        required: false,
        config: {
          fields: [
            { id: "f1", type: "text", label: "Meta title", key: "metaTitle", required: false, config: { maxLength: 70 } },
            { id: "f2", type: "text", label: "Meta description", key: "metaDescription", required: false, config: {} },
          ],
        },
      },
    ]);
    assert.ok(result.success, JSON.stringify(result.error));
    assert.equal(result.data[0]?.key, "seo");
  });
});
