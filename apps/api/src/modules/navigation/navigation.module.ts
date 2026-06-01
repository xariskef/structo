import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { NavigationController } from "./navigation.controller.js";
import { NavigationService } from "./navigation.service.js";

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [NavigationController],
  providers: [NavigationService],
})
export class NavigationModule {}
