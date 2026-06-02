import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";

import { PreviewTokensService } from "./preview-tokens.service.js";

export interface PreviewRequest extends Request {
  previewSiteId?: string;
  previewSiteKey?: string;
  previewEntryId?: string | null;
  previewExpiresAt?: Date;
}

/**
 * Guard for draft-preview delivery routes.
 * Expects the raw token in the Authorization Bearer header.
 * On success it injects `previewSiteId` and `previewEntryId` onto the request.
 */
@Injectable()
export class PreviewTokenGuard implements CanActivate {
  constructor(
    @Inject(PreviewTokensService)
    private readonly previewTokensService: PreviewTokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PreviewRequest>();
    const authorization = request.headers.authorization;
    const rawToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!rawToken) {
      throw new NotFoundException("Preview token required.");
    }

    const resolved = await this.previewTokensService.resolve(rawToken);

    // Route-level scope check: if the token is scoped to a specific entry,
    // it cannot be used to preview the whole site.
    const routeEntryId = request.params["entryId"] ?? null;
    if (
      resolved.entryId !== null &&
      routeEntryId !== null &&
      resolved.entryId !== routeEntryId
    ) {
      throw new NotFoundException("Preview token not found.");
    }

    request.previewSiteId = resolved.siteId;
    request.previewSiteKey = resolved.siteKey;
    request.previewEntryId = resolved.entryId;
    request.previewExpiresAt = resolved.expiresAt;
    return true;
  }
}
