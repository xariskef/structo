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
import { createSiteApiTokenSchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ApiTokensService } from "./api-tokens.service.js";

@Controller("manage")
export class ApiTokensController {
  constructor(
    @Inject(ApiTokensService)
    private readonly apiTokensService: ApiTokensService,
  ) {}

  @Get("sites/:siteId/api-tokens")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.apiTokensService.list(user.id, siteId);
  }

  @Post("sites/:siteId/api-tokens")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.apiTokensService.create(
      user.id,
      siteId,
      parseInput(createSiteApiTokenSchema, body),
    );
  }

  @Delete("sites/:siteId/api-tokens/:tokenId")
  @HttpCode(204)
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("tokenId") tokenId: string,
  ) {
    return this.apiTokensService.revoke(user.id, siteId, tokenId);
  }
}
