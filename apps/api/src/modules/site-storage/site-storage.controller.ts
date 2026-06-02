import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
} from "@nestjs/common";
import { updateSiteStorageSchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SiteStorageService } from "./site-storage.service.js";

@Controller("manage")
export class SiteStorageController {
  constructor(
    @Inject(SiteStorageService)
    private readonly siteStorageService: SiteStorageService,
  ) {}

  @Get("sites/:siteId/storage")
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.siteStorageService.getStatus(user.id, siteId);
  }

  @Put("sites/:siteId/storage")
  @HttpCode(200)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.siteStorageService.update(
      user.id,
      siteId,
      parseInput(updateSiteStorageSchema, body),
    );
  }

  @Delete("sites/:siteId/storage")
  @HttpCode(200)
  clear(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.siteStorageService.clear(user.id, siteId);
  }
}
