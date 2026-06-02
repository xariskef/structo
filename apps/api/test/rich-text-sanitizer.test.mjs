import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sanitizeRichTextData,
  sanitizeRichTextHtml,
} from "../dist/modules/delivery/rich-text-sanitizer.js";

function field(type, key, config = {}) {
  return { id: key, type, key, label: key, required: false, config };
}

test("rich-text sanitizer keeps editor markup and removes executable HTML", () => {
  const html = sanitizeRichTextHtml(
    '<h2>Title</h2><script>alert(1)</script><p onclick="alert(2)">Text <strong>bold</strong> <a href="javascript:alert(3)" target="_blank">bad</a> <a href="/safe" target="_blank">safe</a></p><img src=x onerror="alert(4)">',
  );

  assert.equal(
    html,
    '<h2>Title</h2><p>Text <strong>bold</strong> bad <a href="/safe" target="_blank" rel="noopener noreferrer">safe</a></p>',
  );
});

test("rich-text sanitizer recursively cleans groups and repeater rows", () => {
  const fields = [
    field("richText", "body"),
    field("group", "hero", {
      fields: [field("richText", "summary")],
    }),
    field("repeater", "sections", {
      fields: [field("richText", "content"), field("text", "label")],
    }),
  ];

  assert.deepEqual(
    sanitizeRichTextData(fields, {
      body: "<p>Body<script>bad()</script></p>",
      hero: { summary: '<p onclick="bad()">Hero</p>' },
      sections: [
        { content: '<a href="javascript:bad()">Link</a>', label: "One" },
      ],
    }),
    {
      body: "<p>Body</p>",
      hero: { summary: "<p>Hero</p>" },
      sections: [{ content: "Link", label: "One" }],
    },
  );
});
