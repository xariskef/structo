import { Controller, Delete, Get, Inject, Param, Query } from "@nestjs/common";
import { auditLogsQuerySchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { AuditLogsService } from "./audit-logs.service.js";

@Controller("manage")
export class AuditLogsController {
  constructor(
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get("organizations/:organizationId/audit-logs")
  listForOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param("organizationId") organizationId: string,
    @Query() query: unknown,
  ) {
    return this.auditLogsService.listForOrganization(
      user.id,
      organizationId,
      parseInput(auditLogsQuerySchema, query),
    );
  }

  @Get("sites/:siteId/audit-logs")
  listForSite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Query() query: unknown,
  ) {
    return this.auditLogsService.listForSite(
      user.id,
      siteId,
      parseInput(auditLogsQuerySchema, query),
    );
  }

  @Delete("organizations/:organizationId/audit-logs")
  clearForOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param("organizationId") organizationId: string,
  ) {
    return this.auditLogsService.clearForOrganization(user.id, organizationId);
  }

  @Delete("sites/:siteId/audit-logs")
  clearForSite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.auditLogsService.clearForSite(user.id, siteId);
  }
}
