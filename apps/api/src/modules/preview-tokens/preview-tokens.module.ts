import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DeliveryModule } from "../delivery/delivery.module.js";
import { PreviewDeliveryController } from "./preview-delivery.controller.js";
import { PreviewTokenGuard } from "./preview-token.guard.js";
import { PreviewTokensController } from "./preview-tokens.controller.js";
import { PreviewTokensService } from "./preview-tokens.service.js";

@Module({
  imports: [AuthModule, AuthorizationModule, DeliveryModule],
  controllers: [PreviewTokensController, PreviewDeliveryController],
  providers: [PreviewTokensService, PreviewTokenGuard],
  exports: [PreviewTokensService],
})
export class PreviewTokensModule {}
