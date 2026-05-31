export const FIELD_TYPES = [
  "text",
  "textarea",
  "richtext",
  "number",
  "boolean",
  "select",
  "multiselect",
  "date",
  "datetime",
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

export interface FieldDefinition {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  required: boolean;
  order: number;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  validation?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  children?: FieldDefinition[];
}
