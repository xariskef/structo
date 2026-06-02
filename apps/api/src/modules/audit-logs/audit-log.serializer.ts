import type { AuditLogSummary } from "@structo/contracts";

export type AuditLogRow = {
  id: string;
  organizationId: string | null;
  siteId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
};

export type ActorRow = {
  id: string;
  name: string | null;
  email: string;
};

// Keys whose values must never surface in a read-only activity view, even
// though current writers do not log them. Defence in depth at the boundary.
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|hash|credential|authorization|cookie|api[_-]?key|private[_-]?key/i;

export function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditMetadata(item));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeAuditMetadata(nested);
    }
    return result;
  }

  return value;
}

export function toAuditLogSummary(
  row: AuditLogRow,
  actor: ActorRow | undefined,
): AuditLogSummary {
  return {
    id: row.id,
    organizationId: row.organizationId,
    siteId: row.siteId,
    actorId: row.actorId,
    actorName: actor?.name ?? null,
    actorEmail: actor?.email ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata == null ? null : sanitizeAuditMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}
