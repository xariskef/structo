import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { PlatformController } from "./platform.controller.js";
import { PlatformGuard } from "./platform.guard.js";
import { PlatformService } from "./platform.service.js";

@Module({
  imports: [AuthorizationModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformGuard],
})
export class PlatformModule {}
