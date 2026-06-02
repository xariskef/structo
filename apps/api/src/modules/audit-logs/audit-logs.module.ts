import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { AuditLogsController } from "./audit-logs.controller.js";
import { AuditLogsService } from "./audit-logs.service.js";

@Module({
  imports: [AuthModule, AuthorizationModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
