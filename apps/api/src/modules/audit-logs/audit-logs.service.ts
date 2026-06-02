import { Inject, Injectable } from "@nestjs/common";
import type {
  AuditLogsQuery,
  ClearAuditLogsResult,
  PaginatedAuditLogs,
} from "@structo/contracts";
import { Prisma } from "@structo/database";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";
import { loadAuditLogPage } from "./audit-log.reader.js";

@Injectable()
export class AuditLogsService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async listForOrganization(
    userId: string,
    organizationId: string,
    query: AuditLogsQuery,
  ): Promise<PaginatedAuditLogs> {
    await this.authorizationService.assertOrganizationPermission(
      userId,
      organizationId,
      "organization.view_audit_logs",
    );

    // organizationId is pinned from the authorized route. An optional siteId
    // filter only narrows within the organization; a foreign siteId simply
    // matches nothing rather than leaking another tenant's events.
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };

    return loadAuditLogPage(this.db.client, where, query.page, query.pageSize);
  }

  async listForSite(
    userId: string,
    siteId: string,
    query: AuditLogsQuery,
  ): Promise<PaginatedAuditLogs> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view_audit_logs",
    );

    // The route siteId is authoritative; a client-provided siteId is ignored.
    const where: Prisma.AuditLogWhereInput = {
      siteId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };

    return loadAuditLogPage(this.db.client, where, query.page, query.pageSize);
  }

  async clearForOrganization(
    userId: string,
    organizationId: string,
  ): Promise<ClearAuditLogsResult> {
    await this.authorizationService.assertOrganizationPermission(
      userId,
      organizationId,
      "organization.manage_audit_logs",
    );

    // Clearing is destructive, so the clear itself is recorded as a new event
    // after the deletion — the trail always shows who cleared it and when.
    return this.db.client.$transaction(async (tx) => {
      const deleted = await tx.auditLog.deleteMany({
        where: { organizationId },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: userId,
          action: "audit_log.clear",
          entityType: "AuditLog",
          metadata: { scope: "organization", deletedCount: deleted.count },
        },
      });
      return { deletedCount: deleted.count };
    });
  }

  async clearForSite(
    userId: string,
    siteId: string,
  ): Promise<ClearAuditLogsResult> {
    const access = await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_audit_logs",
    );

    return this.db.client.$transaction(async (tx) => {
      const deleted = await tx.auditLog.deleteMany({ where: { siteId } });
      await tx.auditLog.create({
        data: {
          organizationId: access.organizationId,
          siteId,
          actorId: userId,
          action: "audit_log.clear",
          entityType: "AuditLog",
          metadata: { scope: "site", deletedCount: deleted.count },
        },
      });
      return { deletedCount: deleted.count };
    });
  }
}
