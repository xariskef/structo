import { z } from "zod";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const createPreviewTokenSchema = z.object({
  /** Human-readable label so editors can tell tokens apart. */
  label: z.string().min(1).max(100).trim(),
  /**
   * ISO-8601 datetime; must be in the future and no more than 24 hours away.
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
  /** Frontend Draft Mode URL shown once when the raw token is created. */
  previewUrl: string | null;
}

/** Returned once on creation; the raw token value is never stored. */
export interface PreviewTokenCreated extends PreviewTokenSummary {
  /** The raw token to embed in the preview URL. Only shown once. */
  token: string;
}

export interface PreviewSession {
  siteKey: string;
  entryId: string | null;
  expiresAt: string;
}
