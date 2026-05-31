import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDraftEntryDataSchema,
  buildEntryDataSchema,
} from "@structo/field-kit";

describe("buildEntryDataSchema", () => {
  it("validates required text fields", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "text",
        label: "Title",
        key: "title",
        required: true,
        config: {},
      },
    ]);
    const ok = schema.safeParse({ title: "Hello" });
    assert.ok(ok.success);

    const fail = schema.safeParse({ title: 123 });
    assert.ok(!fail.success);
  });

  it("allows optional fields to be absent", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "text",
        label: "Bio",
        key: "bio",
        required: false,
        config: {},
      },
    ]);
    const result = schema.safeParse({});
    assert.ok(result.success);
  });

  it("validates number fields", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "number",
        label: "Price",
        key: "price",
        required: true,
        config: {},
      },
    ]);
    assert.ok(schema.safeParse({ price: 9.99 }).success);
    assert.ok(!schema.safeParse({ price: "not-a-number" }).success);
  });

  it("validates boolean fields", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "boolean",
        label: "Published",
        key: "published",
        required: true,
        config: {},
      },
    ]);
    assert.ok(schema.safeParse({ published: true }).success);
    assert.ok(schema.safeParse({ published: false }).success);
    assert.ok(!schema.safeParse({ published: "yes" }).success);
  });

  it("validates multiSelect fields as string arrays", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "multiSelect",
        label: "Tags",
        key: "tags",
        required: true,
        config: {
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" },
          ],
        },
      },
    ]);
    assert.ok(schema.safeParse({ tags: ["a", "b"] }).success);
    assert.ok(schema.safeParse({ tags: [] }).success);
    assert.ok(!schema.safeParse({ tags: "a" }).success);
  });

  it("validates group fields recursively", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "group",
        label: "SEO",
        key: "seo",
        required: false,
        config: {
          fields: [
            {
              id: "f2",
              type: "text",
              label: "Meta title",
              key: "metaTitle",
              required: true,
              config: {},
            },
          ],
        },
      },
    ]);
    assert.ok(schema.safeParse({ seo: { metaTitle: "Page title" } }).success);
    assert.ok(!schema.safeParse({ seo: { metaTitle: 123 } }).success);
  });

  it("validates repeater fields as arrays of objects", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "repeater",
        label: "FAQ",
        key: "faq",
        required: false,
        config: {
          fields: [
            {
              id: "f2",
              type: "text",
              label: "Question",
              key: "question",
              required: true,
              config: {},
            },
            {
              id: "f3",
              type: "text",
              label: "Answer",
              key: "answer",
              required: true,
              config: {},
            },
          ],
        },
      },
    ]);
    assert.ok(
      schema.safeParse({
        faq: [
          { question: "What is it?", answer: "A CMS." },
          { question: "How to use?", answer: "Login." },
        ],
      }).success,
    );
    assert.ok(!schema.safeParse({ faq: "not-an-array" }).success);
  });

  it("handles empty field arrays (no fields)", () => {
    const schema = buildEntryDataSchema([]);
    assert.ok(schema.safeParse({}).success);
    assert.ok(!schema.safeParse({ extra: "rejected" }).success);
  });

  it("validates all primitive field types", () => {
    const fields = [
      {
        id: "f1",
        type: "text",
        label: "T",
        key: "t",
        required: true,
        config: {},
      },
      {
        id: "f2",
        type: "textarea",
        label: "A",
        key: "a",
        required: true,
        config: {},
      },
      {
        id: "f3",
        type: "url",
        label: "U",
        key: "u",
        required: true,
        config: {},
      },
      {
        id: "f4",
        type: "email",
        label: "E",
        key: "e",
        required: true,
        config: {},
      },
      {
        id: "f5",
        type: "color",
        label: "C",
        key: "c",
        required: true,
        config: {},
      },
      {
        id: "f6",
        type: "date",
        label: "D",
        key: "d",
        required: true,
        config: {},
      },
      {
        id: "f7",
        type: "dateTime",
        label: "DT",
        key: "dt",
        required: true,
        config: {},
      },
      {
        id: "f8",
        type: "time",
        label: "Ti",
        key: "ti",
        required: true,
        config: {},
      },
    ];
    const schema = buildEntryDataSchema(fields);
    const result = schema.safeParse({
      t: "text",
      a: "area",
      u: "https://x.com",
      e: "e@e.com",
      c: "#ff0000",
      d: "2026-01-01",
      dt: "2026-01-01T12:00",
      ti: "12:00",
    });
    assert.ok(result.success, JSON.stringify(result.error));
  });

  it("rejects invalid formats and undeclared select values", () => {
    const schema = buildEntryDataSchema([
      {
        id: "f1",
        type: "url",
        label: "URL",
        key: "url",
        required: true,
        config: {},
      },
      {
        id: "f2",
        type: "email",
        label: "Email",
        key: "email",
        required: true,
        config: {},
      },
      {
        id: "f3",
        type: "select",
        label: "Status",
        key: "status",
        required: true,
        config: { options: [{ label: "Draft", value: "draft" }] },
      },
    ]);

    assert.ok(
      !schema.safeParse({ url: "nope", email: "nope", status: "unknown" })
        .success,
    );
  });

  it("allows incomplete drafts while validating values that are present", () => {
    const schema = buildDraftEntryDataSchema([
      {
        id: "f1",
        type: "text",
        label: "Title",
        key: "title",
        required: true,
        config: {},
      },
      {
        id: "f2",
        type: "number",
        label: "Price",
        key: "price",
        required: true,
        config: {},
      },
    ]);

    assert.ok(schema.safeParse({}).success);
    assert.ok(schema.safeParse({ title: "Draft" }).success);
    assert.ok(!schema.safeParse({ price: "invalid" }).success);
  });
});
