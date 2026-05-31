import { z } from "zod";

export const FIELD_TYPES = [
  "text",
  "textarea",
  "richText",
  "number",
  "boolean",
  "select",
  "multiSelect",
  "date",
  "dateTime",
  "time",
  "url",
  "email",
  "color",
  "media",
  "gallery",
  "relation",
  "group",
  "repeater",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

// Type-specific config shapes

export interface SelectOption {
  label: string;
  value: string;
}

export interface TextConfig {
  maxLength?: number;
  placeholder?: string;
}

export interface TextareaConfig {
  maxLength?: number;
  rows?: number;
}

export interface NumberConfig {
  min?: number;
  max?: number;
  decimal?: boolean;
}

export interface SelectConfig {
  options: SelectOption[];
}

export interface MultiSelectConfig {
  options: SelectOption[];
  maxSelect?: number;
}

export interface RelationConfig {
  contentTypeId: string;
  labelField: string;
}

export interface GroupConfig {
  fields: FieldDefinition[];
}

export interface RepeaterConfig {
  fields: FieldDefinition[];
  min?: number;
  max?: number;
}

export type FieldConfig =
  | TextConfig
  | TextareaConfig
  | NumberConfig
  | SelectConfig
  | MultiSelectConfig
  | RelationConfig
  | GroupConfig
  | RepeaterConfig
  | Record<string, never>;

// Field definition

export interface FieldDefinition {
  id: string;
  type: FieldType;
  label: string;
  key: string;
  required: boolean;
  description?: string;
  config: FieldConfig;
}

// Field type metadata for the administration UI

export interface FieldTypeMeta {
  label: string;
  description: string;
  group:
    | "Basic"
    | "Selection"
    | "Date & Time"
    | "Specialized"
    | "Media"
    | "Structure";
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  text: { label: "Text", description: "Short plain text", group: "Basic" },
  textarea: {
    label: "Textarea",
    description: "Multi-line plain text",
    group: "Basic",
  },
  richText: {
    label: "Rich text",
    description: "Formatted text with headings & links",
    group: "Basic",
  },
  number: {
    label: "Number",
    description: "Integer or decimal number",
    group: "Basic",
  },
  boolean: {
    label: "Boolean",
    description: "True / false toggle",
    group: "Basic",
  },
  select: {
    label: "Select",
    description: "Pick one option from a list",
    group: "Selection",
  },
  multiSelect: {
    label: "Multi-select",
    description: "Pick multiple options",
    group: "Selection",
  },
  date: { label: "Date", description: "Calendar date", group: "Date & Time" },
  dateTime: {
    label: "Date & time",
    description: "Date with time of day",
    group: "Date & Time",
  },
  time: { label: "Time", description: "Time of day", group: "Date & Time" },
  url: { label: "URL", description: "Web address", group: "Specialized" },
  email: { label: "Email", description: "Email address", group: "Specialized" },
  color: {
    label: "Color",
    description: "Color picker value",
    group: "Specialized",
  },
  media: {
    label: "Media",
    description: "Single image or file",
    group: "Media",
  },
  gallery: {
    label: "Gallery",
    description: "Multiple images or files",
    group: "Media",
  },
  relation: {
    label: "Relation",
    description: "Link to another content type",
    group: "Structure",
  },
  group: {
    label: "Group",
    description: "Nested group of fields",
    group: "Structure",
  },
  repeater: {
    label: "Repeater",
    description: "Repeatable group of fields",
    group: "Structure",
  },
};

export const FIELD_TYPE_GROUPS = [
  "Basic",
  "Selection",
  "Date & Time",
  "Specialized",
  "Media",
  "Structure",
] as const;

export const NESTED_FIELD_TYPES = new Set<FieldType>(["group", "repeater"]);

export function isNestedField(type: FieldType): boolean {
  return NESTED_FIELD_TYPES.has(type);
}

export function createField(
  type: FieldType,
  label: string,
  key: string,
): FieldDefinition {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    key,
    required: false,
    config: isNestedField(type) ? { fields: [] } : {},
  };
}

// Dynamic entry data validation

interface BuildSchemaOptions {
  draft?: boolean;
}

function optionValues(field: FieldDefinition): string[] {
  const config = field.config as SelectConfig | MultiSelectConfig;
  return config.options.map((option) => option.value);
}

function buildFieldSchema(
  field: FieldDefinition,
  options: BuildSchemaOptions,
): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "text": {
      const config = field.config as TextConfig;
      let textSchema = z.string().min(1);
      if (config.maxLength !== undefined) {
        textSchema = textSchema.max(config.maxLength);
      }
      schema = textSchema;
      break;
    }
    case "textarea":
    case "richText": {
      const config = field.config as TextareaConfig;
      let textareaSchema = z.string().min(1);
      if (config.maxLength !== undefined) {
        textareaSchema = textareaSchema.max(config.maxLength);
      }
      schema = textareaSchema;
      break;
    }
    case "url":
      schema = z.string().url();
      break;
    case "email":
      schema = z.string().email();
      break;
    case "color":
      schema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
      break;
    case "date":
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
      break;
    case "dateTime":
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/);
      break;
    case "time":
      schema = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/);
      break;
    case "number": {
      const config = field.config as NumberConfig;
      let numberSchema = z.number();
      if (config.min !== undefined) {
        numberSchema = numberSchema.min(config.min);
      }
      if (config.max !== undefined) {
        numberSchema = numberSchema.max(config.max);
      }
      if (config.decimal === false) {
        numberSchema = numberSchema.int();
      }
      schema = numberSchema;
      break;
    }
    case "boolean":
      schema = z.boolean();
      break;
    case "select": {
      const values = optionValues(field);
      schema = z.string().refine((value) => values.includes(value), {
        message: "Select a declared option.",
      });
      break;
    }
    case "multiSelect": {
      const config = field.config as MultiSelectConfig;
      const values = optionValues(field);
      schema = z
        .array(
          z.string().refine((value) => values.includes(value), {
            message: "Select only declared options.",
          }),
        )
        .max(config.maxSelect ?? Number.POSITIVE_INFINITY);
      break;
    }
    case "media":
    case "relation":
      schema = z.string().min(1);
      break;
    case "gallery":
      schema = z.array(z.string().min(1));
      break;
    case "group": {
      const config = field.config as GroupConfig;
      schema = buildEntryDataSchema(config.fields, options);
      break;
    }
    case "repeater": {
      const config = field.config as RepeaterConfig;
      let repeaterSchema = z.array(
        buildEntryDataSchema(config.fields, options),
      );
      if (config.min !== undefined) {
        repeaterSchema = repeaterSchema.min(config.min);
      }
      if (config.max !== undefined) {
        repeaterSchema = repeaterSchema.max(config.max);
      }
      schema = repeaterSchema;
      break;
    }
    default:
      schema = z.never();
  }

  return field.required && !options.draft ? schema : schema.optional();
}

export function buildEntryDataSchema(
  fields: FieldDefinition[],
  options: BuildSchemaOptions = {},
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.key] = buildFieldSchema(field, options);
  }
  return z.object(shape).strict();
}

export function buildDraftEntryDataSchema(
  fields: FieldDefinition[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return buildEntryDataSchema(fields, { draft: true });
}

export function labelToKey(label: string): string {
  return label
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}
