import { z } from "zod";

const jsonDateTimeSchema = z.string().datetime({ offset: true });

/**
 * Shared query for newest-first, offset-paginated audit-log listings.
 *
 * The authoritative scope (organizationId / siteId / platform-wide) is always
 * enforced server-side from the route and the caller's access. The optional
 * filters below only narrow results inside an already authorized scope and are
 * never trusted to widen it.
 */
export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  siteId: z.string().min(1).max(64).optional(),
  action: z.string().min(1).max(120).optional(),
  entityType: z.string().min(1).max(120).optional(),
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

/**
 * A read-only, presentation-safe audit event. Actor display fields are resolved
 * server-side; `metadata` is sanitized to strip secret-looking keys before it
 * ever leaves the API.
 */
export const auditLogSummarySchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  siteId: z.string().nullable(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: jsonDateTimeSchema,
});

export type AuditLogSummary = z.infer<typeof auditLogSummarySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const paginatedAuditLogsSchema = z.object({
  data: z.array(auditLogSummarySchema),
  meta: paginationMetaSchema,
});

export type PaginatedAuditLogs = z.infer<typeof paginatedAuditLogsSchema>;

export const platformCountsSchema = z.object({
  organizations: z.number().int().min(0),
  sites: z.number().int().min(0),
  users: z.number().int().min(0),
});

export type PlatformCounts = z.infer<typeof platformCountsSchema>;

/**
 * Restricted operator health. Intentionally high level: never carries
 * connection strings, environment values, stack traces or raw database errors.
 */
export const platformHealthSummarySchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["up", "down"]),
  checkedAt: jsonDateTimeSchema,
  counts: platformCountsSchema,
});

export type PlatformHealthSummary = z.infer<typeof platformHealthSummarySchema>;

export const platformOverviewSummarySchema = z.object({
  counts: platformCountsSchema,
  recentAuditLogs: z.array(auditLogSummarySchema),
});

export type PlatformOverviewSummary = z.infer<
  typeof platformOverviewSummarySchema
>;
