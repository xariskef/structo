import type {
  FieldDefinition,
  GroupConfig,
  RepeaterConfig,
} from "@structo/field-kit";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "a",
] as const;

export function sanitizeRichTextHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    exclusiveFilter: (frame) =>
      frame.tag === "a" && !frame.attribs.href ? "excludeTag" : false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...(attributes.href ? { href: attributes.href } : {}),
          ...(attributes.target === "_blank" ? { target: "_blank" } : {}),
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}

export function sanitizeRichTextData(
  fields: FieldDefinition[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...data };

  for (const field of fields) {
    const value = data[field.key];
    if (field.type === "richText" && typeof value === "string") {
      sanitized[field.key] = sanitizeRichTextHtml(value);
      continue;
    }
    if (field.type === "group" && isRecord(value)) {
      const config = field.config as GroupConfig;
      sanitized[field.key] = sanitizeRichTextData(config.fields, value);
      continue;
    }
    if (field.type === "repeater" && Array.isArray(value)) {
      const config = field.config as RepeaterConfig;
      sanitized[field.key] = value.map((row) =>
        isRecord(row) ? sanitizeRichTextData(config.fields, row) : row,
      );
    }
  }

  return sanitized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
