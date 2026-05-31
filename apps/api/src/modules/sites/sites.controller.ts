import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { createSiteSchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { SitesService } from "./sites.service.js";

@Controller("manage")
export class SitesController {
  constructor(
    @Inject(SitesService) private readonly sitesService: SitesService,
  ) {}

  @Get("sites")
  listAccessible(@CurrentUser() user: AuthenticatedUser) {
    return this.sitesService.listAccessible(user.id);
  }

  @Get("sites/:siteId")
  getForUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.sitesService.getForUser(user.id, siteId);
  }

  @Get("organizations/:organizationId/sites")
  listForOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param("organizationId") organizationId: string,
  ) {
    return this.sitesService.listForOrganization(user.id, organizationId);
  }

  @Post("organizations/:organizationId/sites")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.sitesService.create(
      user.id,
      organizationId,
      parseInput(createSiteSchema, body),
    );
  }
}
