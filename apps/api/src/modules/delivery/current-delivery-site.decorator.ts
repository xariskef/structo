import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type {
  DeliveryRequest,
  DeliverySiteContext,
} from "./delivery-token.guard.js";

export const CurrentDeliverySite = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DeliverySiteContext => {
    const request = context.switchToHttp().getRequest<DeliveryRequest>();
    if (!request.deliverySite) {
      throw new Error("Delivery site context is missing.");
    }
    return request.deliverySite;
  },
);
