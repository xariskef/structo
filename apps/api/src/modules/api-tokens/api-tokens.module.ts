import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { ApiTokensController } from "./api-tokens.controller.js";
import { ApiTokensService } from "./api-tokens.service.js";

@Module({
  imports: [AuthModule, AuthorizationModule],
  controllers: [ApiTokensController],
  providers: [ApiTokensService],
})
export class ApiTokensModule {}
