import { FIELD_TYPES } from "@structo/field-kit";
import type { FieldDefinition, FieldType } from "@structo/field-kit";
import { z } from "zod";
import type { EntryStatus } from "./entries.js";
import { taxonomyKindSchema, type TaxonomyKind } from "./taxonomies.js";

// Draft schemas allow incomplete configuration while an administrator is editing.
// Activation applies the stricter configuration checks below.

const fieldKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    "Key must start with a lowercase letter and contain only letters and numbers.",
  );

function addConfigIssue(
  ctx: z.RefinementCtx,
  message: string,
  path: PropertyKey[] = [],
): void {
  ctx.addIssue({
    code: "custom",
    message,
    path: ["config", ...path],
  });
}

function validateUniqueFields(
  fields: FieldDefinition[],
  ctx: z.RefinementCtx,
): void {
  const ids = new Set<string>();
  const keys = new Set<string>();

  fields.forEach((field, index) => {
    if (ids.has(field.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate field id "${field.id}".`,
        path: [index, "id"],
      });
    }
    if (keys.has(field.key)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate field key "${field.key}".`,
        path: [index, "key"],
      });
    }
    ids.add(field.id);
    keys.add(field.key);
  });
}

function validateNestedFields(
  config: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  const result = contentTypeFieldsSchema.safeParse(config.fields);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      addConfigIssue(ctx, issue.message, ["fields", ...issue.path]);
    });
  }
}

const baseFieldDefinitionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FIELD_TYPES as unknown as [FieldType, ...FieldType[]]),
  label: z.string().min(1).max(100),
  key: fieldKeySchema,
  required: z.boolean(),
  description: z.string().max(300).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const fieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  baseFieldDefinitionSchema.superRefine((field, ctx) => {
    if (field.type === "group" || field.type === "repeater") {
      validateNestedFields(field.config, ctx);
    }
  }),
) as z.ZodType<FieldDefinition>;

export const contentTypeFieldsSchema: z.ZodType<FieldDefinition[]> = z.lazy(
  () => z.array(fieldDefinitionSchema).superRefine(validateUniqueFields),
);

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function validateOptions(
  config: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  if (!Array.isArray(config.options) || config.options.length === 0) {
    addConfigIssue(ctx, "At least one option is required.", ["options"]);
    return;
  }

  const values = new Set<string>();
  config.options.forEach((option, index) => {
    if (
      typeof option !== "object" ||
      option === null ||
      !("label" in option) ||
      typeof option.label !== "string" ||
      option.label.trim() === "" ||
      !("value" in option) ||
      typeof option.value !== "string" ||
      option.value.trim() === ""
    ) {
      addConfigIssue(ctx, "Each option requires a label and value.", [
        "options",
        index,
      ]);
      return;
    }
    if (values.has(option.value)) {
      addConfigIssue(ctx, `Duplicate option value "${option.value}".`, [
        "options",
        index,
        "value",
      ]);
    }
    values.add(option.value);
  });
}

function validateActivatableField(
  field: FieldDefinition,
  ctx: z.RefinementCtx,
): void {
  const config = field.config as Record<string, unknown>;

  if (
    (field.type === "text" ||
      field.type === "textarea" ||
      field.type === "richText") &&
    config.maxLength !== undefined &&
    !isPositiveInteger(config.maxLength)
  ) {
    addConfigIssue(ctx, "maxLength must be a positive integer.", ["maxLength"]);
  }

  if (field.type === "number") {
    if (config.min !== undefined && typeof config.min !== "number") {
      addConfigIssue(ctx, "min must be a number.", ["min"]);
    }
    if (config.max !== undefined && typeof config.max !== "number") {
      addConfigIssue(ctx, "max must be a number.", ["max"]);
    }
    if (
      typeof config.min === "number" &&
      typeof config.max === "number" &&
      config.min > config.max
    ) {
      addConfigIssue(ctx, "min cannot be greater than max.");
    }
    if (config.decimal !== undefined && typeof config.decimal !== "boolean") {
      addConfigIssue(ctx, "decimal must be a boolean.", ["decimal"]);
    }
  }

  if (field.type === "select" || field.type === "multiSelect") {
    validateOptions(config, ctx);
  }

  if (
    field.type === "multiSelect" &&
    config.maxSelect !== undefined &&
    !isPositiveInteger(config.maxSelect)
  ) {
    addConfigIssue(ctx, "maxSelect must be a positive integer.", ["maxSelect"]);
  }

  if (field.type === "relation") {
    if (
      typeof config.contentTypeId !== "string" ||
      config.contentTypeId === ""
    ) {
      addConfigIssue(ctx, "contentTypeId is required.", ["contentTypeId"]);
    }
    if (typeof config.labelField !== "string" || config.labelField === "") {
      addConfigIssue(ctx, "labelField is required.", ["labelField"]);
    }
  }

  if (field.type === "group" || field.type === "repeater") {
    const nested = config.fields;
    if (!Array.isArray(nested) || nested.length === 0) {
      addConfigIssue(ctx, "At least one nested field is required.", ["fields"]);
    } else {
      const nestedResult = activatableContentTypeFieldsSchema.safeParse(nested);
      if (!nestedResult.success) {
        nestedResult.error.issues.forEach((issue) => {
          addConfigIssue(ctx, issue.message, ["fields", ...issue.path]);
        });
      }
    }
  }

  if (field.type === "repeater") {
    if (config.min !== undefined && !isPositiveInteger(config.min)) {
      addConfigIssue(ctx, "min must be a positive integer.", ["min"]);
    }
    if (config.max !== undefined && !isPositiveInteger(config.max)) {
      addConfigIssue(ctx, "max must be a positive integer.", ["max"]);
    }
    if (
      typeof config.min === "number" &&
      typeof config.max === "number" &&
      config.min > config.max
    ) {
      addConfigIssue(ctx, "min cannot be greater than max.");
    }
  }
}

function validateConfiguredFields(
  fields: FieldDefinition[],
  ctx: z.RefinementCtx,
): void {
  validateUniqueFields(fields, ctx);
  fields.forEach((field, index) => {
    const nestedContext: z.RefinementCtx = {
      addIssue: (issue) => {
        const normalized =
          typeof issue === "string"
            ? { code: "custom" as const, message: issue }
            : issue;
        ctx.addIssue({
          ...normalized,
          path: [index, ...(normalized.path ?? [])],
        });
      },
    } as z.RefinementCtx;
    validateActivatableField(field, nestedContext);
  });
}

// Some schemas, such as taxonomy custom fields, are active as soon as they are
// saved. They may be empty, but any fields they contain must be fully configured.
export const configuredContentTypeFieldsSchema: z.ZodType<FieldDefinition[]> =
  z.lazy(() =>
    z.array(fieldDefinitionSchema).superRefine(validateConfiguredFields),
  );

export const activatableContentTypeFieldsSchema: z.ZodType<FieldDefinition[]> =
  z.lazy(() =>
    z
      .array(fieldDefinitionSchema)
      .min(1, "A content type must have at least one field before activation.")
      .superRefine(validateConfiguredFields),
  );

// Content type CRUD schemas

export const contentTypeKindSchema = z.enum(["COLLECTION", "SINGLE"]);
export type ContentTypeKind = z.infer<typeof contentTypeKindSchema>;

export const contentTypePresetSchema = z.enum(["blank", "article", "page"]);
export type ContentTypePreset = z.infer<typeof contentTypePresetSchema>;

const contentTypeSlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers and hyphens.",
  );

export const createContentTypeSchema = z
  .object({
    // A collection holds many items (Articles, Products). A single is one
    // standalone page (Home, About).
    kind: contentTypeKindSchema.default("COLLECTION"),
    // Presets only initialize a new schema. The created content type remains
    // fully editable through the same field builder as every other type.
    preset: contentTypePresetSchema.optional(),
    name: z.string().min(1).max(100),
    // Human labels used across the admin UI. Optional; the API derives sensible
    // defaults from `name` when omitted.
    singularName: z.string().min(1).max(100).optional(),
    pluralName: z.string().min(1).max(100).optional(),
    slug: contentTypeSlugSchema,
    description: z.string().max(500).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.preset === "page" && input.kind !== "SINGLE") {
      ctx.addIssue({
        code: "custom",
        message: "The page preset requires a single content type.",
        path: ["preset"],
      });
    }
    if (
      (input.preset === "blank" || input.preset === "article") &&
      input.kind !== "COLLECTION"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Collection presets require a collection content type.",
        path: ["preset"],
      });
    }
  });

export const updateContentTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  singularName: z.string().min(1).max(100).optional(),
  pluralName: z.string().min(1).max(100).optional(),
  slug: contentTypeSlugSchema.optional(),
  description: z.string().max(500).optional(),
  fields: contentTypeFieldsSchema.optional(),
  taxonomies: z
    .array(taxonomyKindSchema)
    .max(2)
    .refine(
      (taxonomies) => new Set(taxonomies).size === taxonomies.length,
      "Taxonomies must be unique.",
    )
    .optional(),
});

export const bulkContentTypesSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive"]),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export type CreateContentTypeInput = z.infer<typeof createContentTypeSchema>;
export type UpdateContentTypeInput = z.infer<typeof updateContentTypeSchema>;
export type BulkContentTypesInput = z.infer<typeof bulkContentTypesSchema>;

// Response types

export interface ContentTypeSummary {
  id: string;
  siteId: string;
  kind: ContentTypeKind;
  name: string;
  singularName: string;
  pluralName: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  fieldCount: number;
  // For single pages this is the id of the one backing item (null until first
  // opened). Collections leave this null.
  singleEntryId: string | null;
  singleEntryStatus: EntryStatus | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentTypeDetail {
  id: string;
  siteId: string;
  kind: ContentTypeKind;
  name: string;
  singularName: string;
  pluralName: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  fields: FieldDefinition[];
  latestVersion: number | null;
  singleEntryId: string | null;
  taxonomies: TaxonomyKind[];
  createdAt: Date;
  updatedAt: Date;
}
