import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { createPreviewTokenSchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PreviewTokensService } from "./preview-tokens.service.js";

@Controller("manage")
export class PreviewTokensController {
  constructor(
    @Inject(PreviewTokensService)
    private readonly previewTokensService: PreviewTokensService,
  ) {}

  @Get("sites/:siteId/preview-tokens")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.previewTokensService.list(user.id, siteId);
  }

  @Post("sites/:siteId/preview-tokens")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.previewTokensService.create(
      user.id,
      siteId,
      parseInput(createPreviewTokenSchema, body),
    );
  }

  @Delete("sites/:siteId/preview-tokens/:tokenId")
  @HttpCode(204)
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("tokenId") tokenId: string,
  ) {
    return this.previewTokensService.revoke(user.id, siteId, tokenId);
  }
}
