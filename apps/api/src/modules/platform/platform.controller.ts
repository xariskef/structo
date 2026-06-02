import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { auditLogsQuerySchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import { PlatformGuard } from "./platform.guard.js";
import { PlatformService } from "./platform.service.js";

@UseGuards(PlatformGuard)
@Controller("platform")
export class PlatformController {
  constructor(
    @Inject(PlatformService)
    private readonly platformService: PlatformService,
  ) {}

  @Get("overview")
  overview() {
    return this.platformService.getOverview();
  }

  @Get("health")
  health() {
    return this.platformService.getHealth();
  }

  @Get("audit-logs")
  auditLogs(@Query() query: unknown) {
    return this.platformService.listAuditLogs(
      parseInput(auditLogsQuerySchema, query),
    );
  }
}
