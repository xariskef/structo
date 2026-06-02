import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { Public } from "../auth/public.decorator.js";
import { DeliveryService } from "../delivery/delivery.service.js";
import { PreviewTokenGuard, type PreviewRequest } from "./preview-token.guard.js";

/**
 * Preview delivery endpoints — returns live draft content.
 * Protected by a short-lived, revocable PreviewToken (query param ?preview=<token>).
 * No authentication required (the token IS the credential).
 */
@Public()
@UseGuards(PreviewTokenGuard)
@Controller("preview")
export class PreviewDeliveryController {
  constructor(
    @Inject(DeliveryService)
    private readonly deliveryService: DeliveryService,
  ) {}

  /**
   * GET /preview/entries/:entryId?preview=<token>
   *
   * Returns the live draft of a single entry. The token must be valid and either
   * scoped to this specific entryId or be a whole-site token for the same site.
   */
  @Get("entries/:entryId")
  getEntry(@Req() req: PreviewRequest, @Param("entryId") entryId: string) {
    // previewSiteId is set by the guard
    return this.deliveryService.getEntryDraft(req.previewSiteId!, entryId);
  }
}
