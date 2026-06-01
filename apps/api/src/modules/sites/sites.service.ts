import { Inject, Injectable } from "@nestjs/common";
import type { CreateSiteInput } from "@structo/contracts";
import { randomBytes } from "node:crypto";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

export interface SiteSummary {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  slug: string;
  status: "ACTIVE" | "ARCHIVED";
}

export interface SiteDetail extends SiteSummary {
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SitesService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async listAccessible(userId: string): Promise<SiteSummary[]> {
    return this.databaseService.client.site.findMany({
      where: {
        OR: [
          {
            organization: {
              memberships: {
                some: { userId },
              },
            },
          },
          {
            memberships: {
              some: { userId },
            },
          },
        ],
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        organizationId: true,
        name: true,
        key: true,
        slug: true,
        status: true,
      },
    });
  }

  async listForOrganization(
    userId: string,
    organizationId: string,
  ): Promise<SiteSummary[]> {
    await this.authorizationService.assertOrganizationPermission(
      userId,
      organizationId,
      "organization.view",
    );

    return this.databaseService.client.site.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        organizationId: true,
        name: true,
        key: true,
        slug: true,
        status: true,
      },
    });
  }

  async create(
    userId: string,
    organizationId: string,
    input: CreateSiteInput,
  ): Promise<SiteSummary> {
    await this.authorizationService.assertOrganizationPermission(
      userId,
      organizationId,
      "organization.manage_sites",
    );

    return this.databaseService.client.site.create({
      data: {
        organizationId,
        name: input.name,
        slug: input.slug,
        key: `site_${randomBytes(18).toString("base64url")}`,
        taxonomyDefinitions: {
          create: [
            {
              scope: "PAGES",
              scopeKey: "pages",
              kind: "CATEGORY",
              versions: { create: { version: 1, fields: [] } },
            },
            {
              scope: "PAGES",
              scopeKey: "pages",
              kind: "TAG",
              versions: { create: { version: 1, fields: [] } },
            },
          ],
        },
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        key: true,
        slug: true,
        status: true,
      },
    });
  }

  async getForUser(userId: string, siteId: string): Promise<SiteDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    return this.databaseService.client.site.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        key: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
