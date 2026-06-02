import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DeliveryController } from "./delivery.controller.js";
import { DeliveryService } from "./delivery.service.js";
import { DeliveryTokenGuard } from "./delivery-token.guard.js";
import { DeliveryTokenService } from "./delivery-token.service.js";

@Module({
  imports: [AuthModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryTokenService, DeliveryTokenGuard],
  exports: [DeliveryService],
})
export class DeliveryModule {}
