import { z } from "zod";

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
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export type EntryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface EntrySummary {
  id: string;
  siteId: string;
  contentTypeId: string;
  contentTypeName: string;
  title: string;
  slug: string;
  status: EntryStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryDetail extends EntrySummary {
  data: Record<string, unknown>;
  contentTypeVersionId: string;
  latestRevision: number | null;
}

export interface RevisionSummary {
  id: string;
  revision: number;
  status: EntryStatus;
  createdAt: Date;
}
