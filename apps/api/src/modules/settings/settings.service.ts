import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  SiteSettings,
  UpdateSiteSettingsInput,
} from "@structo/contracts";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

const SETTING_KEYS = [
  "defaultLocale",
  "timezone",
  "publicBaseUrl",
  "seoTitle",
  "seoDescription",
  "brandName",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async getSettings(userId: string, siteId: string): Promise<SiteSettings> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const [site, rows] = await Promise.all([
      this.databaseService.client.site
        .findUniqueOrThrow({ where: { id: siteId } })
        .catch(() => {
          throw new NotFoundException("Site not found.");
        }),
      this.databaseService.client.siteSetting.findMany({
        where: { siteId },
      }),
    ]);

    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      name: site.name,
      slug: site.slug,
      defaultLocale: map.get("defaultLocale") ?? null,
      timezone: map.get("timezone") ?? null,
      publicBaseUrl: map.get("publicBaseUrl") ?? null,
      seoTitle: map.get("seoTitle") ?? null,
      seoDescription: map.get("seoDescription") ?? null,
      brandName: map.get("brandName") ?? null,
    };
  }

  async updateSettings(
    userId: string,
    siteId: string,
    input: UpdateSiteSettingsInput,
  ): Promise<SiteSettings> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_settings",
    );

    const site = await this.databaseService.client.site
      .findUniqueOrThrow({ where: { id: siteId } })
      .catch(() => {
        throw new NotFoundException("Site not found.");
      });

    const settingUpdates = SETTING_KEYS.filter(
      (key): key is SettingKey =>
        key in input && input[key as keyof typeof input] !== undefined,
    );

    try {
      await this.databaseService.client.$transaction([
        ...(input.name !== undefined || input.slug !== undefined
          ? [
              this.databaseService.client.site.update({
                where: { id: siteId },
                data: {
                  ...(input.name !== undefined ? { name: input.name } : {}),
                  ...(input.slug !== undefined ? { slug: input.slug } : {}),
                },
              }),
            ]
          : []),

        ...settingUpdates.map((key) =>
          this.databaseService.client.siteSetting.upsert({
            where: { siteId_key: { siteId, key } },
            create: { siteId, key, value: String(input[key] ?? "") },
            update: { value: String(input[key] ?? "") },
          }),
        ),

        this.databaseService.client.auditLog.create({
          data: {
            organizationId: site.organizationId,
            siteId,
            actorId: userId,
            action: "site.settings.update",
            entityType: "Site",
            entityId: siteId,
            metadata: { updatedFields: Object.keys(input) },
          },
        }),
      ]);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new ConflictException(
          "A site with this slug already exists in the organization.",
        );
      }

      throw error;
    }

    return this.getSettings(userId, siteId);
  }
}
