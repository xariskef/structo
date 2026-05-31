import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
