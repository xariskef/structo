import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { DeliveryTokenService } from "./delivery-token.service.js";

export interface DeliverySiteContext {
  id: string;
  key: string;
}

export interface DeliveryRequest extends Request {
  deliverySite?: DeliverySiteContext;
}

@Injectable()
export class DeliveryTokenGuard implements CanActivate {
  constructor(
    @Inject(DeliveryTokenService)
    private readonly deliveryTokenService: DeliveryTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeliveryRequest>();
    const authorization = request.header("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/);
    const rawToken = match?.[1];
    if (!rawToken) {
      throw new UnauthorizedException("A Bearer delivery token is required.");
    }
    const resolved = await this.deliveryTokenService.resolve(rawToken);
    if (request.params.siteKey !== resolved.site.key) {
      throw new NotFoundException("Site not found.");
    }
    request.deliverySite = resolved.site;
    void this.deliveryTokenService
      .touchLastUsed(resolved.token.id)
      .catch(() => undefined);
    return true;
  }
}
