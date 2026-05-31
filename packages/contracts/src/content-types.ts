import { FIELD_TYPES } from "@structo/field-kit";
import type { FieldDefinition, FieldType } from "@structo/field-kit";
import { z } from "zod";

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

export const activatableContentTypeFieldsSchema: z.ZodType<FieldDefinition[]> =
  z.lazy(() =>
    z
      .array(fieldDefinitionSchema)
      .min(1, "A content type must have at least one field before activation.")
      .superRefine((fields, ctx) => {
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
      }),
  );

// Content type CRUD schemas

export const contentTypeKindSchema = z.enum(["COLLECTION", "SINGLE"]);
export type ContentTypeKind = z.infer<typeof contentTypeKindSchema>;

const contentTypeSlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers and hyphens.",
  );

export const createContentTypeSchema = z.object({
  // A collection holds many items (Articles, Products). A single is one
  // standalone page (Home, About).
  kind: contentTypeKindSchema.default("COLLECTION"),
  name: z.string().min(1).max(100),
  // Human labels used across the admin UI. Optional; the API derives sensible
  // defaults from `name` when omitted.
  singularName: z.string().min(1).max(100).optional(),
  pluralName: z.string().min(1).max(100).optional(),
  slug: contentTypeSlugSchema,
  description: z.string().max(500).optional(),
});

export const updateContentTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  singularName: z.string().min(1).max(100).optional(),
  pluralName: z.string().min(1).max(100).optional(),
  slug: contentTypeSlugSchema.optional(),
  description: z.string().max(500).optional(),
  fields: contentTypeFieldsSchema.optional(),
});

export type CreateContentTypeInput = z.infer<typeof createContentTypeSchema>;
export type UpdateContentTypeInput = z.infer<typeof updateContentTypeSchema>;

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
  createdAt: Date;
  updatedAt: Date;
}
