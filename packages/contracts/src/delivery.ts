import { z } from "zod";

export const DELIVERY_READ_SCOPE = "content:read" as const;
const jsonDateTimeSchema = z.string().datetime({ offset: true });

export const createSiteApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export type CreateSiteApiTokenInput = z.infer<typeof createSiteApiTokenSchema>;

export const siteApiTokenSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: jsonDateTimeSchema.nullable(),
  expiresAt: jsonDateTimeSchema.nullable(),
  revokedAt: jsonDateTimeSchema.nullable(),
  createdAt: jsonDateTimeSchema,
});

export type SiteApiTokenSummary = z.infer<typeof siteApiTokenSummarySchema>;

export const siteApiTokenCreatedSchema = siteApiTokenSummarySchema.extend({
  token: z.string(),
});

export type SiteApiTokenCreated = z.infer<typeof siteApiTokenCreatedSchema>;

const deliverySlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const deliveryEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(["publishedAt:desc", "publishedAt:asc", "title:asc", "title:desc"])
    .default("publishedAt:desc"),
  category: deliverySlugSchema.optional(),
  tag: deliverySlugSchema.optional(),
});

export type DeliveryEntriesQuery = z.infer<typeof deliveryEntriesQuerySchema>;

export const deliverySiteSchema = z.object({
  name: z.string(),
  slug: z.string(),
  defaultLocale: z.string().nullable(),
  timezone: z.string().nullable(),
  publicBaseUrl: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  brandName: z.string().nullable(),
});

export const deliveryContentTypeSchema = z.object({
  kind: z.enum(["COLLECTION", "SINGLE"]),
  slug: z.string(),
  name: z.string(),
  singularName: z.string(),
  pluralName: z.string(),
  description: z.string().nullable(),
  fields: z.array(z.unknown()),
  taxonomies: z.array(z.enum(["CATEGORY", "TAG"])),
});

export const deliveryTermSchema = z.object({
  kind: z.enum(["CATEGORY", "TAG"]),
  name: z.string(),
  slug: z.string(),
});

export const deliveryEntrySchema = z.object({
  contentTypeSlug: z.string(),
  title: z.string(),
  slug: z.string(),
  data: z.record(z.string(), z.unknown()),
  excerpt: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  publishedAt: jsonDateTimeSchema.nullable(),
  updatedAt: jsonDateTimeSchema,
  terms: z.array(deliveryTermSchema),
});

export interface DeliveryMenuItem {
  label: string;
  url: string;
  target: "_self" | "_blank";
  children: DeliveryMenuItem[];
}

export const deliveryMenuItemSchema: z.ZodType<DeliveryMenuItem> = z.lazy(() =>
  z.object({
    label: z.string(),
    url: z.string(),
    target: z.enum(["_self", "_blank"]),
    children: z.array(deliveryMenuItemSchema),
  }),
);

export const deliveryMenuSchema = z.object({
  key: z.string(),
  name: z.string(),
  items: z.array(deliveryMenuItemSchema),
});

export const deliveryListMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export function deliveryListSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: deliveryListMetaSchema,
  });
}

export type DeliverySite = z.infer<typeof deliverySiteSchema>;
export type DeliveryContentType = z.infer<typeof deliveryContentTypeSchema>;
export type DeliveryTerm = z.infer<typeof deliveryTermSchema>;
export type DeliveryEntry = z.infer<typeof deliveryEntrySchema>;
export type DeliveryMenu = z.infer<typeof deliveryMenuSchema>;
export type DeliveryListMeta = z.infer<typeof deliveryListMetaSchema>;
export type DeliveryEntryList = z.infer<
  ReturnType<typeof deliveryListSchema<typeof deliveryEntrySchema>>
>;
