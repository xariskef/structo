import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  activatableContentTypeFieldsSchema,
  type BulkContentTypesInput,
  type ContentTypeDetail,
  type ContentTypeKind,
  type ContentTypeSummary,
  type CreateContentTypeInput,
  type EntryStatus,
  type TaxonomyKind,
  type UpdateContentTypeInput,
} from "@structo/contracts";
import { createField } from "@structo/field-kit";
import type { FieldDefinition } from "@structo/field-kit";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";
import { EntriesService } from "../entries/entries.service.js";

// Every new content type starts with a built-in rich-text body, like the
// default WordPress editor. It can be removed from the Structure tab.
function defaultContentFields(): FieldDefinition[] {
  return [createField("richText", "Content", "content")];
}

// Shape returned by the queries below: a content type row plus the relation
// data needed to build summaries and details.
type ContentTypeRow = {
  id: string;
  siteId: string;
  kind: ContentTypeKind;
  name: string;
  singularName: string | null;
  pluralName: string | null;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  fields: unknown;
  createdAt: Date;
  updatedAt: Date;
  entries?: { id: string; status?: EntryStatus }[];
  taxonomies?: { taxonomy: TaxonomyKind }[];
  _count?: { entries: number };
};

@Injectable()
export class ContentTypesService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
    @Inject(EntriesService)
    private readonly entriesService: EntriesService,
  ) {}

  // Bulk actions for the Pages list. Publish/unpublish act on each single
  // page's backing item; archive archives the content type itself.
  async bulk(
    userId: string,
    siteId: string,
    input: BulkContentTypesInput,
  ): Promise<{ affected: number; failed: number }> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      input.action === "archive"
        ? "site.manage_content_types"
        : "site.publish_content",
    );

    const owned = await this.db.client.contentType.findMany({
      where: { id: { in: input.ids }, siteId },
      select: { id: true, kind: true, status: true },
    });
    if (owned.length !== input.ids.length) {
      throw new BadRequestException(
        "Some content types do not belong to this site.",
      );
    }
    if (owned.some((contentType) => contentType.kind !== "SINGLE")) {
      throw new BadRequestException(
        "Bulk page actions only accept single pages.",
      );
    }

    let affected = 0;
    let failed = 0;
    for (const id of input.ids) {
      try {
        if (input.action === "archive") {
          await this.archive(userId, siteId, id);
        } else {
          const contentType = owned.find((candidate) => candidate.id === id);
          if (contentType?.status !== "ACTIVE") {
            throw new BadRequestException(
              "Only active pages can be published or unpublished.",
            );
          }
          const single = await this.entriesService.getOrCreateSingle(
            userId,
            siteId,
            id,
          );
          if (input.action === "publish") {
            await this.entriesService.publish(userId, siteId, single.id);
          } else {
            await this.entriesService.unpublish(userId, siteId, single.id);
          }
        }
        affected += 1;
      } catch {
        failed += 1;
      }
    }

    return { affected, failed };
  }

  async list(
    userId: string,
    siteId: string,
    kind?: ContentTypeKind,
  ): Promise<ContentTypeSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const rows = await this.db.client.contentType.findMany({
      where: { siteId, ...(kind ? { kind } : {}) },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { entries: true } },
        entries: {
          select: { id: true, status: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        taxonomies: { select: { taxonomy: true } },
      },
    });

    return rows.map((row) => this.toSummary(row as ContentTypeRow));
  }

  async create(
    userId: string,
    siteId: string,
    input: CreateContentTypeInput,
  ): Promise<ContentTypeDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_content_types",
    );

    const site = await this.findSite(siteId);
    const singularName = input.singularName ?? input.name;
    const pluralName = input.pluralName ?? input.name;

    try {
      const contentType = await this.db.client.$transaction(
        async (transaction) => {
          const created = await transaction.contentType.create({
            data: {
              siteId,
              kind: input.kind,
              name: input.name,
              singularName,
              pluralName,
              slug: input.slug,
              description: input.description ?? null,
              fields: JSON.parse(JSON.stringify(defaultContentFields())),
            },
          });

          if (created.kind === "COLLECTION") {
            const scopeKey = `content-type:${created.id}`;
            for (const kind of ["CATEGORY", "TAG"] as const) {
              await transaction.taxonomyDefinition.create({
                data: {
                  siteId,
                  contentTypeId: created.id,
                  scope: "CONTENT_TYPE",
                  scopeKey,
                  kind,
                  versions: { create: { version: 1, fields: [] } },
                },
              });
            }
          }

          await transaction.auditLog.create({
            data: {
              organizationId: site.organizationId,
              siteId,
              actorId: userId,
              action: "content_type.create",
              entityType: "ContentType",
              entityId: created.id,
              metadata: {
                kind: created.kind,
                name: created.name,
                slug: created.slug,
              },
            },
          });

          return created;
        },
      );

      return this.toDetail(contentType as ContentTypeRow, null, null);
    } catch (error: unknown) {
      this.throwSlugConflict(error);
    }
  }

  async get(
    userId: string,
    siteId: string,
    contentTypeId: string,
  ): Promise<ContentTypeDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const contentType = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { version: true },
        },
        entries: {
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        taxonomies: { select: { taxonomy: true } },
      },
    });

    if (!contentType || contentType.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    return this.toDetail(
      contentType as ContentTypeRow,
      contentType.versions[0]?.version ?? null,
      contentType.entries[0]?.id ?? null,
    );
  }

  async update(
    userId: string,
    siteId: string,
    contentTypeId: string,
    input: UpdateContentTypeInput,
  ): Promise<ContentTypeDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_content_types",
    );

    const existing = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
      include: { site: { select: { organizationId: true } } },
    });

    if (!existing || existing.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    if (existing.status === "ARCHIVED") {
      throw new BadRequestException("Archived content types cannot be edited.");
    }

    try {
      await this.db.client.$transaction([
        this.db.client.contentType.update({
          where: { id: contentTypeId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.singularName !== undefined
              ? { singularName: input.singularName }
              : {}),
            ...(input.pluralName !== undefined
              ? { pluralName: input.pluralName }
              : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.fields !== undefined
              ? { fields: JSON.parse(JSON.stringify(input.fields)) }
              : {}),
          },
        }),
        ...(input.taxonomies !== undefined
          ? [
              this.db.client.contentTypeTaxonomy.deleteMany({
                where: { contentTypeId },
              }),
              this.db.client.contentEntryTaxonomyTerm.deleteMany({
                where: {
                  entry: { contentTypeId },
                  ...(input.taxonomies.length > 0
                    ? { term: { kind: { notIn: input.taxonomies } } }
                    : {}),
                },
              }),
              ...input.taxonomies.map((taxonomy) =>
                this.db.client.contentTypeTaxonomy.create({
                  data: { siteId, contentTypeId, taxonomy },
                }),
              ),
            ]
          : []),
        this.db.client.auditLog.create({
          data: {
            organizationId: existing.site.organizationId,
            siteId,
            actorId: userId,
            action: "content_type.update",
            entityType: "ContentType",
            entityId: contentTypeId,
            metadata: { updatedFields: Object.keys(input) },
          },
        }),
      ]);

      return this.get(userId, siteId, contentTypeId);
    } catch (error: unknown) {
      this.throwSlugConflict(error);
    }
  }

  async activate(
    userId: string,
    siteId: string,
    contentTypeId: string,
  ): Promise<ContentTypeDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_content_types",
    );

    const contentType = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
      include: {
        site: { select: { organizationId: true } },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { version: true },
        },
      },
    });

    if (!contentType || contentType.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    if (contentType.status === "ARCHIVED") {
      throw new BadRequestException(
        "Archived content types cannot be activated.",
      );
    }

    const fieldsResult = activatableContentTypeFieldsSchema.safeParse(
      contentType.fields,
    );
    if (!fieldsResult.success) {
      const messages = fieldsResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new BadRequestException(
        `Content type schema is invalid: ${messages}`,
      );
    }

    const nextVersion = (contentType.versions[0]?.version ?? 0) + 1;

    await this.db.client.$transaction([
      this.db.client.contentType.update({
        where: { id: contentTypeId },
        data: { status: "ACTIVE" },
      }),
      this.db.client.contentTypeVersion.create({
        data: {
          contentTypeId,
          version: nextVersion,
          fields: JSON.parse(JSON.stringify(fieldsResult.data)),
          createdById: userId,
        },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: contentType.site.organizationId,
          siteId,
          actorId: userId,
          action: "content_type.activate",
          entityType: "ContentType",
          entityId: contentTypeId,
          metadata: { version: nextVersion },
        },
      }),
    ]);

    return this.get(userId, siteId, contentTypeId);
  }

  async archive(
    userId: string,
    siteId: string,
    contentTypeId: string,
  ): Promise<ContentTypeDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_content_types",
    );

    const contentType = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
      include: { site: { select: { organizationId: true } } },
    });

    if (!contentType || contentType.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    await this.db.client.$transaction([
      this.db.client.contentType.update({
        where: { id: contentTypeId },
        data: { status: "ARCHIVED" },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: contentType.site.organizationId,
          siteId,
          actorId: userId,
          action: "content_type.archive",
          entityType: "ContentType",
          entityId: contentTypeId,
        },
      }),
    ]);

    return this.get(userId, siteId, contentTypeId);
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

  private throwSlugConflict(error: unknown): never {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new ConflictException(
        "A content type with this slug already exists.",
      );
    }
    throw error;
  }

  private toSummary(row: ContentTypeRow): ContentTypeSummary {
    return {
      id: row.id,
      siteId: row.siteId,
      kind: row.kind,
      name: row.name,
      singularName: row.singularName ?? row.name,
      pluralName: row.pluralName ?? row.name,
      slug: row.slug,
      status: row.status,
      fieldCount: Array.isArray(row.fields) ? row.fields.length : 0,
      singleEntryId:
        row.kind === "SINGLE" ? (row.entries?.[0]?.id ?? null) : null,
      singleEntryStatus:
        row.kind === "SINGLE" ? (row.entries?.[0]?.status ?? null) : null,
      itemCount: row._count?.entries ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toDetail(
    row: ContentTypeRow,
    latestVersion: number | null,
    singleEntryId: string | null,
  ): ContentTypeDetail {
    return {
      id: row.id,
      siteId: row.siteId,
      kind: row.kind,
      name: row.name,
      singularName: row.singularName ?? row.name,
      pluralName: row.pluralName ?? row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      fields: Array.isArray(row.fields)
        ? (row.fields as FieldDefinition[])
        : [],
      latestVersion,
      singleEntryId: row.kind === "SINGLE" ? singleEntryId : null,
      taxonomies: row.taxonomies?.map(({ taxonomy }) => taxonomy) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
