import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { WebhooksModule } from "../webhooks/webhooks.module.js";
import { EntriesController } from "./entries.controller.js";
import { EntriesService } from "./entries.service.js";
import { SchedulingService } from "./scheduling.service.js";

@Module({
  imports: [DatabaseModule, AuthorizationModule, WebhooksModule],
  controllers: [EntriesController],
  providers: [EntriesService, SchedulingService],
  exports: [EntriesService],
})
export class EntriesModule {}
