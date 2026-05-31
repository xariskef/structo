import { Inject, Injectable } from "@nestjs/common";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  memberships: Array<{ role: string }>;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    return this.databaseService.client.organization.findMany({
      where: {
        memberships: {
          some: { userId },
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        memberships: {
          where: { userId },
          select: { role: true },
        },
      },
    });
  }

  async getForUser(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationDetail> {
    await this.authorizationService.assertOrganizationPermission(
      userId,
      organizationId,
      "organization.view",
    );

    return this.databaseService.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
