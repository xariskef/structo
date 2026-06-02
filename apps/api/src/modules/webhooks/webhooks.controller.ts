import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { createWebhookSchema, updateWebhookSchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { WebhooksService } from "./webhooks.service.js";

@Controller("manage")
export class WebhooksController {
  constructor(
    @Inject(WebhooksService)
    private readonly webhooksService: WebhooksService,
  ) {}

  @Get("sites/:siteId/webhooks")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.webhooksService.list(user.id, siteId);
  }

  @Post("sites/:siteId/webhooks")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.webhooksService.create(
      user.id,
      siteId,
      parseInput(createWebhookSchema, body),
    );
  }

  @Patch("sites/:siteId/webhooks/:webhookId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("webhookId") webhookId: string,
    @Body() body: unknown,
  ) {
    return this.webhooksService.update(
      user.id,
      siteId,
      webhookId,
      parseInput(updateWebhookSchema, body),
    );
  }

  @Delete("sites/:siteId/webhooks/:webhookId")
  @HttpCode(204)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("webhookId") webhookId: string,
  ) {
    return this.webhooksService.delete(user.id, siteId, webhookId);
  }

  @Post("sites/:siteId/webhooks/:webhookId/test")
  @HttpCode(204)
  test(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("webhookId") webhookId: string,
  ) {
    return this.webhooksService.sendTestPing(user.id, siteId, webhookId);
  }
}
