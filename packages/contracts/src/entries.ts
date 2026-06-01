import type { FieldDefinition } from "@structo/field-kit";
import { z } from "zod";

import type { ContentTypeKind } from "./content-types.js";

const entrySlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers and hyphens.",
  );

export const createEntrySchema = z.object({
  contentTypeId: z.string().min(1),
  title: z.string().min(1).max(200),
  slug: entrySlugSchema,
  data: z.record(z.string(), z.unknown()).default({}),
});

export const updateEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: entrySlugSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  excerpt: z.string().max(300).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});

export const bulkEntriesSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive", "delete"]),
  entryIds: z.array(z.string().min(1)).min(1).max(200),
});

export const scheduleEntrySchema = z.object({
  publishAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date.")),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type BulkEntriesInput = z.infer<typeof bulkEntriesSchema>;
export type ScheduleEntryInput = z.infer<typeof scheduleEntrySchema>;

export type EntryStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface EntrySummary {
  id: string;
  siteId: string;
  contentTypeId: string;
  contentTypeName: string;
  contentTypeKind: ContentTypeKind;
  contentTypeSlug: string;
  title: string;
  slug: string;
  status: EntryStatus;
  excerpt: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryDetail extends EntrySummary {
  data: Record<string, unknown>;
  contentTypeVersionId: string;
  fields: FieldDefinition[];
  seoTitle: string | null;
  seoDescription: string | null;
  latestRevision: number | null;
}

export interface RevisionSummary {
  id: string;
  revision: number;
  status: EntryStatus;
  createdAt: Date;
}
