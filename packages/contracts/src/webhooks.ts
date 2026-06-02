import { z } from "zod";

// ---------------------------------------------------------------------------
// Supported events
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  "entry.published",
  "entry.unpublished",
  "entry.deleted",
  "entry.scheduled",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const createWebhookSchema = z.object({
  label: z.string().min(1).max(100).trim(),
  url: z
    .string()
    .url("Must be a valid URL.")
    .startsWith("https://", "Webhook URL must use HTTPS."),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, "Select at least one event."),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  label: z.string().min(1).max(100).trim().optional(),
  url: z
    .string()
    .url("Must be a valid URL.")
    .startsWith("https://", "Webhook URL must use HTTPS.")
    .optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface WebhookSummary {
  id: string;
  label: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  lastTriggeredAt: string | null;
  lastDeliveryOk: boolean | null;
  createdAt: string;
}

/** Returned once on creation — the raw secret is never stored or shown again. */
export interface WebhookCreated extends WebhookSummary {
  /** HMAC-SHA256 signing secret. Prefix: `whsec_`. Show once, then discard. */
  secret: string;
}

// ---------------------------------------------------------------------------
// Delivery payload
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  event: WebhookEvent;
  siteKey: string;
  timestamp: string;
  data: {
    id: string;
    contentTypeSlug: string;
    slug: string;
    title: string;
    status: string;
  };
}
