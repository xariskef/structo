import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type {
  OrganizationInvitationInput,
  SiteInvitationInput,
} from "@structo/contracts";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { CryptoService } from "../auth/crypto.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { INVITATION_DURATION_MS } from "../auth/auth.constants.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService,
  ) {}

  async createForOrganization(
    actorUserId: string,
    organizationId: string,
    input: OrganizationInvitationInput,
  ) {
    await this.authorizationService.assertOrganizationPermission(
      actorUserId,
      organizationId,
      "organization.manage_members",
    );

    const token = this.cryptoService.createToken();

    await this.databaseService.client.invitation.create({
      data: {
        email: input.email,
        organizationId,
        organizationRole: input.role,
        tokenHash: this.cryptoService.hashToken(token),
        expiresAt: new Date(Date.now() + INVITATION_DURATION_MS),
        createdById: actorUserId,
      },
    });

    return { token };
  }

  async createForSite(
    actorUserId: string,
    siteId: string,
    input: SiteInvitationInput,
  ) {
    const access = await this.authorizationService.assertSitePermission(
      actorUserId,
      siteId,
      "site.manage_members",
    );
    const token = this.cryptoService.createToken();

    await this.databaseService.client.invitation.create({
      data: {
        email: input.email,
        organizationId: access.organizationId,
        siteId,
        siteRole: input.role,
        tokenHash: this.cryptoService.hashToken(token),
        expiresAt: new Date(Date.now() + INVITATION_DURATION_MS),
        createdById: actorUserId,
      },
    });

    return { token };
  }

  async accept(user: AuthenticatedUser, token: string) {
    const tokenHash = this.cryptoService.hashToken(token);
    const now = new Date();

    return this.databaseService.client.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
      });

      if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt <= now ||
        invitation.email !== user.email
      ) {
        throw new UnauthorizedException("Invitation is invalid or expired.");
      }

      if (invitation.siteId && invitation.siteRole) {
        await tx.siteMembership.upsert({
          where: {
            siteId_userId: {
              siteId: invitation.siteId,
              userId: user.id,
            },
          },
          create: {
            siteId: invitation.siteId,
            userId: user.id,
            role: invitation.siteRole,
          },
          update: {
            role: invitation.siteRole,
          },
        });
      } else if (invitation.organizationRole) {
        await tx.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: user.id,
            },
          },
          create: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.organizationRole,
          },
          update: {
            role: invitation.organizationRole,
          },
        });
      } else {
        throw new UnauthorizedException("Invitation is invalid.");
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: now },
      });

      return { success: true };
    });
  }
}
