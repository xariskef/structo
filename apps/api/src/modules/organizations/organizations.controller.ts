import { Controller, Get, Inject, Param } from "@nestjs/common";

import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { OrganizationsService } from "./organizations.service.js";

@Controller("manage/organizations")
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService)
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  listForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listForUser(user.id);
  }

  @Get(":organizationId")
  getForUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("organizationId") organizationId: string,
  ) {
    return this.organizationsService.getForUser(user.id, organizationId);
  }
}
