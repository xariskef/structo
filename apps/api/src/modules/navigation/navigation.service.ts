import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateNavigationMenuInput,
  NavigationLinkTargets,
  NavigationMenuDetail,
  NavigationMenuItem,
  NavigationMenuSummary,
  UpdateNavigationMenuInput,
} from "@structo/contracts";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

type MenuRow = {
  id: string;
  siteId: string;
  name: string;
  key: string;
  items: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class NavigationService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(userId: string, siteId: string): Promise<NavigationMenuSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const existing = await this.db.client.navigationMenu.findMany({
      where: { siteId },
      orderBy: { createdAt: "asc" },
    });

    // Seed a default "Main menu" the first time the area is opened.
    if (existing.length === 0) {
      const site = await this.findSite(siteId);
      const created = await this.db.client.navigationMenu.create({
        data: { siteId, name: "Main menu", key: "main", items: [] },
      });
      await this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "navigation_menu.create",
          entityType: "NavigationMenu",
          entityId: created.id,
          metadata: { key: created.key, seeded: true },
        },
      });
      return [this.toSummary(created)];
    }

    return existing.map((menu) => this.toSummary(menu));
  }

  async create(
    userId: string,
    siteId: string,
    input: CreateNavigationMenuInput,
  ): Promise<NavigationMenuDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_navigation",
    );

    const site = await this.findSite(siteId);

    try {
      const menu = await this.db.client.$transaction(async (transaction) => {
        const created = await transaction.navigationMenu.create({
          data: { siteId, name: input.name, key: input.key, items: [] },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: site.organizationId,
            siteId,
            actorId: userId,
            action: "navigation_menu.create",
            entityType: "NavigationMenu",
            entityId: created.id,
            metadata: { key: created.key, name: created.name },
          },
        });
        return created;
      });
      return this.toDetail(menu);
    } catch (error: unknown) {
      this.throwKeyConflict(error);
    }
  }

  async get(
    userId: string,
    siteId: string,
    menuId: string,
  ): Promise<NavigationMenuDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );
    return this.toDetail(await this.findMenu(menuId, siteId));
  }

  async update(
    userId: string,
    siteId: string,
    menuId: string,
    input: UpdateNavigationMenuInput,
  ): Promise<NavigationMenuDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_navigation",
    );

    const existing = await this.findMenu(menuId, siteId);
    const site = await this.findSite(siteId);

    await this.db.client.$transaction([
      this.db.client.navigationMenu.update({
        where: { id: menuId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.items !== undefined
            ? { items: JSON.parse(JSON.stringify(input.items)) }
            : {}),
        },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "navigation_menu.update",
          entityType: "NavigationMenu",
          entityId: menuId,
          metadata: { updatedFields: Object.keys(input) },
        },
      }),
    ]);

    void existing;
    return this.get(userId, siteId, menuId);
  }

  async remove(userId: string, siteId: string, menuId: string): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_navigation",
    );

    const menu = await this.findMenu(menuId, siteId);
    const site = await this.findSite(siteId);

    await this.db.client.$transaction([
      this.db.client.navigationMenu.delete({ where: { id: menuId } }),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "navigation_menu.delete",
          entityType: "NavigationMenu",
          entityId: menuId,
          metadata: { key: menu.key },
        },
      }),
    ]);
  }

  // Aggregated link targets for the menu item picker.
  async linkTargets(
    userId: string,
    siteId: string,
  ): Promise<NavigationLinkTargets> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const [types, entries] = await Promise.all([
      this.db.client.contentType.findMany({
        where: { siteId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          kind: true,
          name: true,
          pluralName: true,
          slug: true,
        },
      }),
      this.db.client.contentEntry.findMany({
        where: { siteId, status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          contentType: { select: { kind: true, slug: true } },
        },
      }),
    ]);

    const pages = types
      .filter((type) => type.kind === "SINGLE")
      .map((type) => ({
        id: type.id,
        label: type.name,
        url: `/${type.slug}`,
      }));

    const collectionArchives = types
      .filter((type) => type.kind === "COLLECTION")
      .map((type) => ({
        id: type.id,
        label: type.pluralName ?? type.name,
        url: `/${type.slug}`,
      }));

    const collectionItems = entries
      .filter((entry) => entry.contentType.kind === "COLLECTION")
      .map((entry) => ({
        id: entry.id,
        label: entry.title,
        url: `/${entry.contentType.slug}/${entry.slug}`,
      }));

    return { pages, collectionArchives, collectionItems };
  }

  private async findSite(siteId: string): Promise<{ organizationId: string }> {
    const site = await this.db.client.site.findUnique({
      where: { id: siteId },
      select: { organizationId: true },
    });
    if (!site) {
      throw new NotFoundException("Site not found.");
    }
    return site;
  }

  private async findMenu(menuId: string, siteId: string): Promise<MenuRow> {
    const menu = await this.db.client.navigationMenu.findUnique({
      where: { id: menuId },
    });
    if (!menu || menu.siteId !== siteId) {
      throw new NotFoundException("Navigation menu not found.");
    }
    return menu;
  }

  private toItems(value: unknown): NavigationMenuItem[] {
    return Array.isArray(value) ? (value as NavigationMenuItem[]) : [];
  }

  private countItems(items: NavigationMenuItem[]): number {
    return items.reduce(
      (total, item) => total + 1 + this.countItems(item.children ?? []),
      0,
    );
  }

  private toSummary(menu: MenuRow): NavigationMenuSummary {
    return {
      id: menu.id,
      siteId: menu.siteId,
      name: menu.name,
      key: menu.key,
      itemCount: this.countItems(this.toItems(menu.items)),
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
    };
  }

  private toDetail(menu: MenuRow): NavigationMenuDetail {
    return { ...this.toSummary(menu), items: this.toItems(menu.items) };
  }

  private throwKeyConflict(error: unknown): never {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new ConflictException("A menu with this key already exists.");
    }
    throw error;
  }
}
