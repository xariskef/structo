import type { AuditLogSummary, PaginatedAuditLogs } from "@structo/contracts";
import { Prisma, type PrismaClient } from "@structo/database";

import {
  toAuditLogSummary,
  type ActorRow,
  type AuditLogRow,
} from "./audit-log.serializer.js";

/**
 * Shared newest-first, offset-paginated audit-log reader. The `where` clause is
 * always built by the caller from an authorized scope; this helper never widens
 * it. Actor display data is resolved in one batched query to avoid N+1.
 */
export async function loadAuditLogPage(
  client: PrismaClient,
  where: Prisma.AuditLogWhereInput,
  page: number,
  pageSize: number,
): Promise<PaginatedAuditLogs> {
  const [rows, total] = await client.$transaction([
    client.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    client.auditLog.count({ where }),
  ]);

  const actors = await resolveActors(client, rows);

  return {
    data: rows.map((row) =>
      toAuditLogSummary(row, actors.get(row.actorId ?? "")),
    ),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function loadRecentAuditLogs(
  client: PrismaClient,
  limit: number,
): Promise<AuditLogSummary[]> {
  const rows = await client.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const actors = await resolveActors(client, rows);
  return rows.map((row) =>
    toAuditLogSummary(row, actors.get(row.actorId ?? "")),
  );
}

async function resolveActors(
  client: PrismaClient,
  rows: Pick<AuditLogRow, "actorId">[],
): Promise<Map<string, ActorRow>> {
  const ids = [
    ...new Set(
      rows.map((row) => row.actorId).filter((id): id is string => id !== null),
    ),
  ];
  if (ids.length === 0) {
    return new Map();
  }

  const users = await client.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}
