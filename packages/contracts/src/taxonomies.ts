import type { FieldDefinition } from "@structo/field-kit";
import { z } from "zod";

export const taxonomyKindSchema = z.enum(["CATEGORY", "TAG"]);
export type TaxonomyKind = z.infer<typeof taxonomyKindSchema>;

export const taxonomyScopeSchema = z.enum(["PAGES", "CONTENT_TYPE"]);
export type TaxonomyScope = z.infer<typeof taxonomyScopeSchema>;

const taxonomySlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers and hyphens.",
  );

const taxonomyTermDataSchema = z.record(z.string(), z.unknown());

export const taxonomyDefinitionQuerySchema = z
  .object({
    scope: taxonomyScopeSchema,
    contentTypeId: z.string().min(1).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.scope === "CONTENT_TYPE" && !input.contentTypeId) {
      ctx.addIssue({
        code: "custom",
        message: "contentTypeId is required for a content-type taxonomy scope.",
        path: ["contentTypeId"],
      });
    }
    if (input.scope === "PAGES" && input.contentTypeId) {
      ctx.addIssue({
        code: "custom",
        message: "Pages taxonomy scopes do not accept contentTypeId.",
        path: ["contentTypeId"],
      });
    }
  });

export const updateTaxonomyDefinitionSchema = z.object({
  fields: z.array(z.unknown()),
});

export const createTaxonomyTermSchema = z.object({
  name: z.string().min(1).max(100),
  slug: taxonomySlugSchema,
  description: z.string().max(2_000).optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
  data: taxonomyTermDataSchema.default({}),
  parentId: z.string().min(1).optional(),
});

export const updateTaxonomyTermSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: taxonomySlugSchema.optional(),
  description: z.string().max(2_000).nullable().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  data: taxonomyTermDataSchema.optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const assignTaxonomyTermsSchema = z.object({
  termIds: z
    .array(z.string().min(1))
    .max(200)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Term ids must be unique.",
    ),
});

export type TaxonomyDefinitionQuery = z.infer<
  typeof taxonomyDefinitionQuerySchema
>;
export type UpdateTaxonomyDefinitionInput = z.infer<
  typeof updateTaxonomyDefinitionSchema
>;
export type CreateTaxonomyTermInput = z.infer<typeof createTaxonomyTermSchema>;
export type UpdateTaxonomyTermInput = z.infer<typeof updateTaxonomyTermSchema>;
export type AssignTaxonomyTermsInput = z.infer<
  typeof assignTaxonomyTermsSchema
>;

export interface TaxonomyDefinitionDetail {
  id: string;
  siteId: string;
  contentTypeId: string | null;
  scope: TaxonomyScope;
  scopeKey: string;
  kind: TaxonomyKind;
  fields: FieldDefinition[];
  latestVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxonomyTermSummary {
  id: string;
  siteId: string;
  taxonomyDefinitionId: string;
  taxonomyDefinitionVersionId: string;
  kind: TaxonomyKind;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  data: Record<string, unknown>;
  parentId: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}
