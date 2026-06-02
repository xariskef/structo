import { z } from "zod";

export const MEDIA_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MEDIA_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

export const updateMediaAssetSchema = z.object({
  alt: z.string().max(300).nullable().optional(),
  caption: z.string().max(1000).nullable().optional(),
});

export type UpdateMediaAssetInput = z.infer<typeof updateMediaAssetSchema>;

export interface MediaAssetSummary {
  id: string;
  siteId: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryMediaAsset = Omit<
  MediaAssetSummary,
  "siteId" | "createdAt" | "updatedAt"
>;
