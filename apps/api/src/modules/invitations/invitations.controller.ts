import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import {
  acceptInvitationSchema,
  organizationInvitationSchema,
  siteInvitationSchema,
} from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { InvitationsService } from "./invitations.service.js";

@Controller("manage")
export class InvitationsController {
  constructor(
    @Inject(InvitationsService)
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post("organizations/:organizationId/invitations")
  createForOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.invitationsService.createForOrganization(
      user.id,
      organizationId,
      parseInput(organizationInvitationSchema, body),
    );
  }

  @Post("sites/:siteId/invitations")
  createForSite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.invitationsService.createForSite(
      user.id,
      siteId,
      parseInput(siteInvitationSchema, body),
    );
  }

  @Post("invitations/accept")
  accept(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.invitationsService.accept(
      user,
      parseInput(acceptInvitationSchema, body).token,
    );
  }
}
