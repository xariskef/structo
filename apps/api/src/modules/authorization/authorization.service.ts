import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  OrganizationMembershipRole,
  SiteMembershipRole,
} from "@structo/database";

import { DatabaseService } from "../database/database.service.js";
import {
  INHERITED_SITE_PERMISSIONS,
  ORGANIZATION_ROLE_PERMISSIONS,
  SITE_ROLE_PERMISSIONS,
  type OrganizationPermission,
  type SitePermission,
} from "./permissions.js";

export interface SiteAccess {
  organizationId: string;
  inheritedRole: OrganizationMembershipRole | null;
  directRole: SiteMembershipRole | null;
  permissions: ReadonlySet<SitePermission>;
}

@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async assertOrganizationPermission(
    userId: string,
    organizationId: string,
    permission: OrganizationPermission,
  ): Promise<OrganizationMembershipRole> {
    const membership =
      await this.databaseService.client.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });

    if (
      !membership ||
      !ORGANIZATION_ROLE_PERMISSIONS[membership.role].includes(permission)
    ) {
      throw new NotFoundException();
    }

    return membership.role;
  }

  async assertSitePermission(
    userId: string,
    siteId: string,
    permission: SitePermission,
  ): Promise<SiteAccess> {
    const site = await this.databaseService.client.site.findUnique({
      where: { id: siteId },
      select: { organizationId: true },
    });

    if (!site) {
      throw new NotFoundException();
    }

    const [organizationMembership, siteMembership] = await Promise.all([
      this.databaseService.client.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: site.organizationId,
            userId,
          },
        },
      }),
      this.databaseService.client.siteMembership.findUnique({
        where: {
          siteId_userId: {
            siteId,
            userId,
          },
        },
      }),
    ]);

    const permissions = new Set<SitePermission>([
      ...(organizationMembership
        ? INHERITED_SITE_PERMISSIONS[organizationMembership.role]
        : []),
      ...(siteMembership ? SITE_ROLE_PERMISSIONS[siteMembership.role] : []),
    ]);

    if (!permissions.has(permission)) {
      throw new NotFoundException();
    }

    return {
      organizationId: site.organizationId,
      inheritedRole: organizationMembership?.role ?? null,
      directRole: siteMembership?.role ?? null,
      permissions,
    };
  }
}
