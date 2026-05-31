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

// ── Type-specific config shapes ────────────────────────────────────────

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

// ── Field definition ───────────────────────────────────────────────────

export interface FieldDefinition {
  id: string;
  type: FieldType;
  label: string;
  key: string;
  required: boolean;
  description?: string;
  config: FieldConfig;
}

// ── Field type metadata (for UI) ────────────────────────────────────────

export interface FieldTypeMeta {
  label: string;
  description: string;
  group: "Basic" | "Selection" | "Date & Time" | "Specialized" | "Media" | "Structure";
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  text:        { label: "Text",         description: "Short plain text",                     group: "Basic" },
  textarea:    { label: "Textarea",     description: "Multi-line plain text",                group: "Basic" },
  richText:    { label: "Rich text",    description: "Formatted text with headings & links", group: "Basic" },
  number:      { label: "Number",       description: "Integer or decimal number",            group: "Basic" },
  boolean:     { label: "Boolean",      description: "True / false toggle",                  group: "Basic" },
  select:      { label: "Select",       description: "Pick one option from a list",          group: "Selection" },
  multiSelect: { label: "Multi-select", description: "Pick multiple options",                group: "Selection" },
  date:        { label: "Date",         description: "Calendar date",                        group: "Date & Time" },
  dateTime:    { label: "Date & time",  description: "Date with time of day",               group: "Date & Time" },
  time:        { label: "Time",         description: "Time of day",                          group: "Date & Time" },
  url:         { label: "URL",          description: "Web address",                          group: "Specialized" },
  email:       { label: "Email",        description: "Email address",                        group: "Specialized" },
  color:       { label: "Color",        description: "Color picker value",                   group: "Specialized" },
  media:       { label: "Media",        description: "Single image or file",                 group: "Media" },
  gallery:     { label: "Gallery",      description: "Multiple images or files",             group: "Media" },
  relation:    { label: "Relation",     description: "Link to another content type",         group: "Structure" },
  group:       { label: "Group",        description: "Nested group of fields",               group: "Structure" },
  repeater:    { label: "Repeater",     description: "Repeatable group of fields",           group: "Structure" },
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
  const base: FieldDefinition = {
    id: crypto.randomUUID(),
    type,
    label,
    key,
    required: false,
    config: isNestedField(type) ? { fields: [] } : {},
  };

  return base;
}

export function labelToKey(label: string): string {
  return label
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}
