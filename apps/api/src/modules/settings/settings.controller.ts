import { Body, Controller, Get, HttpCode, Inject, Param, Patch } from "@nestjs/common";
import { updateSiteSettingsSchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SettingsService } from "./settings.service.js";

@Controller("manage")
export class SettingsController {
  constructor(
    @Inject(SettingsService)
    private readonly settingsService: SettingsService,
  ) {}

  @Get("sites/:siteId/settings")
  getSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.settingsService.getSettings(user.id, siteId);
  }

  @Patch("sites/:siteId/settings")
  @HttpCode(200)
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.settingsService.updateSettings(
      user.id,
      siteId,
      parseInput(updateSiteSettingsSchema, body),
    );
  }
}
