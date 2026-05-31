import { FIELD_TYPES } from "@structo/field-kit";
import type { FieldDefinition, FieldType } from "@structo/field-kit";
import { z } from "zod";

// ── Field validation ────────────────────────────────────────────────────

const fieldKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    "Key must start with a lowercase letter and contain only letters and numbers.",
  );

export const fieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.enum(FIELD_TYPES as unknown as [FieldType, ...FieldType[]]),
    label: z.string().min(1).max(100),
    key: fieldKeySchema,
    required: z.boolean(),
    description: z.string().max(300).optional(),
    config: z.record(z.string(), z.unknown()).default({}),
  }),
);

export const contentTypeFieldsSchema = z.array(fieldDefinitionSchema);

// ── Content type CRUD schemas ────────────────────────────────────────────

export const createContentTypeSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers and hyphens.",
    ),
  description: z.string().max(500).optional(),
});

export const updateContentTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(500).optional(),
  fields: contentTypeFieldsSchema.optional(),
});

export type CreateContentTypeInput = z.infer<typeof createContentTypeSchema>;
export type UpdateContentTypeInput = z.infer<typeof updateContentTypeSchema>;

// ── Response types ────────────────────────────────────────────────────────

export interface ContentTypeSummary {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  fieldCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentTypeDetail {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  fields: FieldDefinition[];
  latestVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
}
