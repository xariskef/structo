import { z } from "zod";

export const STORAGE_PROVIDERS = ["r2"] as const;

/**
 * Per-site storage configuration input. The secret access key is write-only:
 * omit it on update to keep the stored value. It is encrypted at rest and never
 * returned by the API.
 */
export const updateSiteStorageSchema = z.object({
  provider: z.enum(STORAGE_PROVIDERS),
  accountId: z.string().min(1).max(100),
  accessKeyId: z.string().min(1).max(200),
  secretAccessKey: z.string().min(1).max(500).optional(),
  bucket: z.string().min(1).max(100),
  publicBaseUrl: z.string().url().max(500),
});

export type UpdateSiteStorageInput = z.infer<typeof updateSiteStorageSchema>;

/**
 * Read-only status of a site's storage configuration. Never carries the secret
 * access key — only whether one is set.
 */
export const siteStorageStatusSchema = z.object({
  configured: z.boolean(),
  usingFallback: z.boolean(),
  provider: z.enum(STORAGE_PROVIDERS).nullable(),
  accountId: z.string().nullable(),
  accessKeyId: z.string().nullable(),
  bucket: z.string().nullable(),
  publicBaseUrl: z.string().nullable(),
  secretSet: z.boolean(),
});

export type SiteStorageStatus = z.infer<typeof siteStorageStatusSchema>;
