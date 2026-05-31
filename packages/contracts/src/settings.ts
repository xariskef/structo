import { z } from "zod";

export const updateSiteSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers and hyphens only.",
    )
    .optional(),
  defaultLocale: z.string().max(10).optional(),
  timezone: z.string().max(60).optional(),
  publicBaseUrl: z
    .string()
    .url("Must be a valid URL.")
    .optional()
    .or(z.literal("")),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  brandName: z.string().max(100).optional(),
});

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;

export interface SiteSettings {
  name: string;
  slug: string;
  defaultLocale: string | null;
  timezone: string | null;
  publicBaseUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  brandName: string | null;
}
