import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  DeliveryContentType,
  DeliveryEntriesQuery,
  DeliveryEntry,
  DeliveryEntryList,
  DeliveryMediaAsset,
  DeliveryMenu,
  DeliveryMenuItem,
  DeliverySite,
} from "@structo/contracts";
import type { FieldDefinition } from "@structo/field-kit";
import {
  buildDraftEntryDataSchema,
  collectMediaAssetIds,
} from "@structo/field-kit";

import type { NavigationMenuItem } from "@structo/contracts";
import { DatabaseService } from "../database/database.service.js";
import { sanitizeRichTextData } from "./rich-text-sanitizer.js";

type ContentTypeRow = {
  id: string;
  kind: "COLLECTION" | "SINGLE";
  slug: string;
  name: string;
  singularName: string | null;
  pluralName: string | null;
  description: string | null;
  versions: { fields: unknown }[];
  taxonomies: { taxonomy: "CATEGORY" | "TAG" }[];
};

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
  ) {}

  async getSettings(siteId: string): Promise<DeliverySite> {
    const site = await this.db.client.site.findUnique({
      where: { id: siteId },
      include: { settings: true },
    });
    if (!site) throw new NotFoundException("Site not found.");
    const settings = new Map(site.settings.map((row) => [row.key, row.value]));
    return {
      name: site.name,
      slug: site.slug,
      defaultLocale: settings.get("defaultLocale") ?? null,
      timezone: settings.get("timezone") ?? null,
      publicBaseUrl: settings.get("publicBaseUrl") ?? null,
      seoTitle: settings.get("seoTitle") ?? null,
      seoDescription: settings.get("seoDescription") ?? null,
      brandName: settings.get("brandName") ?? null,
    };
  }

  async listContentTypes(siteId: string): Promise<DeliveryContentType[]> {
    const contentTypes = await this.db.client.contentType.findMany({
      where: { siteId, status: "ACTIVE" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { fields: true },
        },
        taxonomies: { select: { taxonomy: true } },
      },
      orderBy: { name: "asc" },
    });
    return contentTypes.map((contentType) =>
      this.toContentType(contentType as ContentTypeRow),
    );
  }

  async getContentType(
    siteId: string,
    slug: string,
  ): Promise<DeliveryContentType> {
    return this.toContentType(await this.findContentType(siteId, slug));
  }

  async listEntries(
    siteId: string,
    contentTypeSlug: string,
    query: DeliveryEntriesQuery,
  ): Promise<DeliveryEntryList> {
    const contentType = await this.findContentType(siteId, contentTypeSlug);
    const where = {
      siteId,
      contentTypeId: contentType.id,
      status: "PUBLISHED" as const,
      publishedRevisionId: { not: null as null },
      AND: [
        ...(query.category
          ? [
              {
                publishedRevision: {
                  terms: {
                    some: { kind: "CATEGORY", slug: query.category },
                  },
                },
              },
            ]
          : []),
        ...(query.tag
          ? [
              {
                publishedRevision: {
                  terms: { some: { kind: "TAG", slug: query.tag } },
                },
              },
            ]
          : []),
      ],
    };
    const [entries, total] = await this.db.client.$transaction([
      this.db.client.contentEntry.findMany({
        where,
        include: {
          publishedRevision: { include: { terms: true } },
        },
        orderBy: this.toOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.client.contentEntry.count({ where }),
    ]);
    return {
      data: await Promise.all(
        entries.map((entry) =>
          this.toEntry(
            siteId,
            contentType.slug,
            contentType.versions[0]?.fields,
            entry,
          ),
        ),
      ),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getEntry(
    siteId: string,
    contentTypeSlug: string,
    entrySlug: string,
  ): Promise<DeliveryEntry> {
    const contentType = await this.findContentType(siteId, contentTypeSlug);
    const entry = await this.db.client.contentEntry.findFirst({
      where: {
        siteId,
        contentTypeId: contentType.id,
        status: "PUBLISHED",
        publishedRevision: { slug: entrySlug },
      },
      include: { publishedRevision: { include: { terms: true } } },
    });
    if (!entry) throw new NotFoundException("Entry not found.");
    return this.toEntry(
      siteId,
      contentType.slug,
      contentType.versions[0]?.fields,
      entry,
    );
  }

  async listMenus(siteId: string): Promise<DeliveryMenu[]> {
    const menus = await this.db.client.navigationMenu.findMany({
      where: { siteId },
      orderBy: { createdAt: "asc" },
    });
    return Promise.all(
      menus.map(async (menu) => ({
        key: menu.key,
        name: menu.name,
        items: await this.renderMenuItems(siteId, this.toMenuItems(menu.items)),
      })),
    );
  }

  async getMenu(siteId: string, key: string): Promise<DeliveryMenu> {
    const menu = await this.db.client.navigationMenu.findUnique({
      where: { siteId_key: { siteId, key } },
    });
    if (!menu) throw new NotFoundException("Navigation menu not found.");
    return {
      key: menu.key,
      name: menu.name,
      items: await this.renderMenuItems(siteId, this.toMenuItems(menu.items)),
    };
  }

  private async findContentType(
    siteId: string,
    slug: string,
  ): Promise<ContentTypeRow> {
    const contentType = await this.db.client.contentType.findFirst({
      where: { siteId, slug, status: "ACTIVE" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { fields: true },
        },
        taxonomies: { select: { taxonomy: true } },
      },
    });
    if (!contentType || !contentType.versions[0]) {
      throw new NotFoundException("Content type not found.");
    }
    return contentType as ContentTypeRow;
  }

  private toContentType(contentType: ContentTypeRow): DeliveryContentType {
    return {
      kind: contentType.kind,
      slug: contentType.slug,
      name: contentType.name,
      singularName: contentType.singularName ?? contentType.name,
      pluralName: contentType.pluralName ?? contentType.name,
      description: contentType.description,
      fields: this.toFields(contentType.versions[0]?.fields),
      taxonomies: contentType.taxonomies.map(({ taxonomy }) => taxonomy),
    };
  }

  private async toEntry(
    siteId: string,
    contentTypeSlug: string,
    fields: unknown,
    entry: {
      publishedAt: Date | null;
      updatedAt: Date;
      publishedRevision: {
        title: string;
        slug: string;
        data: unknown;
        excerpt: string | null;
        seoTitle: string | null;
        seoDescription: string | null;
        terms: { kind: string; name: string; slug: string }[];
      } | null;
    },
  ): Promise<DeliveryEntry> {
    // Fall back to a bare snapshot if publishedRevision is somehow missing
    // (should not happen for valid published entries).
    const snap = entry.publishedRevision;
    if (!snap) throw new NotFoundException("Entry has no published snapshot.");
    return {
      contentTypeSlug,
      title: snap.title,
      slug: snap.slug,
      data: await this.renderData(siteId, fields, snap.data),
      excerpt: snap.excerpt,
      seoTitle: snap.seoTitle,
      seoDescription: snap.seoDescription,
      publishedAt: entry.publishedAt?.toISOString() ?? null,
      updatedAt: entry.updatedAt.toISOString(),
      terms: snap.terms.map((t) => ({
        kind: t.kind as "CATEGORY" | "TAG",
        name: t.name,
        slug: t.slug,
      })),
    };
  }

  private async renderData(
    siteId: string,
    fields: unknown,
    value: unknown,
  ): Promise<Record<string, unknown>> {
    const data = this.isRecord(value) ? value : {};
    const declaredFields = this.toFields(fields);
    const result = buildDraftEntryDataSchema(declaredFields).safeParse(data);
    const sanitized = sanitizeRichTextData(
      declaredFields,
      result.success ? result.data : data,
    );
    const ids = collectMediaAssetIds(declaredFields, sanitized);
    if (ids.length === 0) return sanitized;
    const assets = await this.db.client.mediaAsset.findMany({
      where: { siteId, id: { in: ids } },
    });
    const byId = new Map(
      assets.map((asset) => [asset.id, this.toMediaAsset(asset)]),
    );
    return this.hydrateMediaData(declaredFields, sanitized, byId);
  }

  private hydrateMediaData(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
    assets: Map<string, DeliveryMediaAsset>,
  ): Record<string, unknown> {
    const hydrated = { ...data };
    for (const field of fields) {
      const value = data[field.key];
      if (field.type === "media" && typeof value === "string") {
        hydrated[field.key] = assets.get(value) ?? null;
      } else if (field.type === "gallery" && Array.isArray(value)) {
        hydrated[field.key] = value.flatMap((id) => {
          const asset = typeof id === "string" ? assets.get(id) : undefined;
          return asset ? [asset] : [];
        });
      } else if (field.type === "group" && this.isRecord(value)) {
        hydrated[field.key] = this.hydrateMediaData(
          this.toFields((field.config as Record<string, unknown>).fields),
          value,
          assets,
        );
      } else if (field.type === "repeater" && Array.isArray(value)) {
        const nested = this.toFields(
          (field.config as Record<string, unknown>).fields,
        );
        hydrated[field.key] = value.map((row) =>
          this.isRecord(row) ? this.hydrateMediaData(nested, row, assets) : row,
        );
      }
    }
    return hydrated;
  }

  private toMediaAsset(asset: {
    id: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    alt: string | null;
    caption: string | null;
  }): DeliveryMediaAsset {
    return {
      id: asset.id,
      url: asset.url,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
      caption: asset.caption,
    };
  }

  private async renderMenuItems(
    siteId: string,
    items: NavigationMenuItem[],
  ): Promise<DeliveryMenuItem[]> {
    return Promise.all(
      items.map(async (item) => ({
        label: item.label,
        url: await this.resolveMenuUrl(siteId, item),
        target: item.target,
        children: await this.renderMenuItems(siteId, item.children ?? []),
      })),
    );
  }

  private async resolveMenuUrl(
    siteId: string,
    item: NavigationMenuItem,
  ): Promise<string> {
    if (!item.reference) return item.url;
    if (
      item.reference.kind === "page" ||
      item.reference.kind === "collectionArchive"
    ) {
      const kind =
        item.reference.kind === "page"
          ? ("SINGLE" as const)
          : ("COLLECTION" as const);
      const contentType = await this.db.client.contentType.findFirst({
        where: { id: item.reference.id, siteId, status: "ACTIVE", kind },
        select: { slug: true },
      });
      return contentType ? `/${contentType.slug}` : item.url;
    }
    const entry = await this.db.client.contentEntry.findFirst({
      where: { id: item.reference.id, siteId, status: "PUBLISHED" },
      select: { slug: true, contentType: { select: { slug: true } } },
    });
    return entry ? `/${entry.contentType.slug}/${entry.slug}` : item.url;
  }

  private toOrderBy(sort: DeliveryEntriesQuery["sort"]) {
    const [field, direction] = sort.split(":") as [
      "publishedAt" | "title",
      "asc" | "desc",
    ];
    return { [field]: direction };
  }

  private toMenuItems(value: unknown): NavigationMenuItem[] {
    return Array.isArray(value) ? (value as NavigationMenuItem[]) : [];
  }

  private toFields(value: unknown): FieldDefinition[] {
    return Array.isArray(value) ? (value as FieldDefinition[]) : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
