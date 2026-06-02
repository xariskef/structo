import { Inject, Injectable } from "@nestjs/common";
import type {
  AuditLogsQuery,
  PaginatedAuditLogs,
  PlatformCounts,
  PlatformHealthSummary,
  PlatformOverviewSummary,
} from "@structo/contracts";
import { Prisma } from "@structo/database";

import {
  loadAuditLogPage,
  loadRecentAuditLogs,
} from "../audit-logs/audit-log.reader.js";
import { DatabaseService } from "../database/database.service.js";

const RECENT_AUDIT_LOG_LIMIT = 10;

@Injectable()
export class PlatformService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
  ) {}

  async getOverview(): Promise<PlatformOverviewSummary> {
    const [counts, recentAuditLogs] = await Promise.all([
      this.countEntities(),
      loadRecentAuditLogs(this.db.client, RECENT_AUDIT_LOG_LIMIT),
    ]);
    return { counts, recentAuditLogs };
  }

  async getHealth(): Promise<PlatformHealthSummary> {
    const checkedAt = new Date().toISOString();
    let database: PlatformHealthSummary["database"] = "up";
    let counts: PlatformCounts = { organizations: 0, sites: 0, users: 0 };

    try {
      await this.db.client.$queryRaw`SELECT 1`;
      counts = await this.countEntities();
    } catch {
      // Never surface connection strings or raw database errors to operators.
      database = "down";
    }

    return {
      status: database === "up" ? "ok" : "degraded",
      database,
      checkedAt,
      counts,
    };
  }

  async listAuditLogs(query: AuditLogsQuery): Promise<PaginatedAuditLogs> {
    // Platform-wide: no tenant pin, optional filters only narrow the result.
    const where: Prisma.AuditLogWhereInput = {
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };
    return loadAuditLogPage(this.db.client, where, query.page, query.pageSize);
  }

  private async countEntities(): Promise<PlatformCounts> {
    const [organizations, sites, users] = await this.db.client.$transaction([
      this.db.client.organization.count(),
      this.db.client.site.count(),
      this.db.client.user.count(),
    ]);
    return { organizations, sites, users };
  }
}
