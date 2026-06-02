import { z } from "zod";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const createPreviewTokenSchema = z.object({
  /** Human-readable label so editors can tell tokens apart. */
  label: z.string().min(1).max(100).trim(),
  /**
   * ISO-8601 datetime; must be in the future.
   * Maximum: 1 year from now is not enforced here — enforce it in the service.
   */
  expiresAt: z.string().datetime({ offset: true }),
  /**
   * Optional: scope the token to a single content entry.
   * When absent the token grants draft-read for the whole site.
   */
  entryId: z.string().min(1).max(64).optional(),
});

export type CreatePreviewTokenInput = z.infer<typeof createPreviewTokenSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface PreviewTokenSummary {
  id: string;
  label: string;
  entryId: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  /** URL the editor can copy-paste to preview draft content. */
  previewUrl: string;
}

/** Returned once on creation; the raw token value is never stored. */
export interface PreviewTokenCreated extends PreviewTokenSummary {
  /** The raw token to embed in the preview URL. Only shown once. */
  token: string;
}
