import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  activatableContentTypeFieldsSchema,
  type ContentTypeDetail,
  type ContentTypeSummary,
  type CreateContentTypeInput,
  type UpdateContentTypeInput,
} from "@structo/contracts";
import type { FieldDefinition } from "@structo/field-kit";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class ContentTypesService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(userId: string, siteId: string): Promise<ContentTypeSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const rows = await this.db.client.contentType.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    });

    return rows.map((contentType) => ({
      id: contentType.id,
      siteId: contentType.siteId,
      name: contentType.name,
      slug: contentType.slug,
      status: contentType.status,
      fieldCount: Array.isArray(contentType.fields)
        ? contentType.fields.length
        : 0,
      createdAt: contentType.createdAt,
      updatedAt: contentType.updatedAt,
    }));
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

    try {
      const contentType = await this.db.client.$transaction(
        async (transaction) => {
          const created = await transaction.contentType.create({
            data: {
              siteId,
              name: input.name,
              slug: input.slug,
              description: input.description ?? null,
              fields: [],
            },
          });

          await transaction.auditLog.create({
            data: {
              organizationId: site.organizationId,
              siteId,
              actorId: userId,
              action: "content_type.create",
              entityType: "ContentType",
              entityId: created.id,
              metadata: { name: created.name, slug: created.slug },
            },
          });

          return created;
        },
      );

      return this.toDetail(contentType, null);
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
      },
    });

    if (!contentType || contentType.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    return this.toDetail(contentType, contentType.versions[0]?.version ?? null);
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
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.fields !== undefined
              ? { fields: JSON.parse(JSON.stringify(input.fields)) }
              : {}),
          },
        }),
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

    const [updated] = await this.db.client.$transaction([
      this.db.client.contentType.update({
        where: { id: contentTypeId },
        data: { status: "ACTIVE" },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { version: true },
          },
        },
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

    return this.toDetail(updated, nextVersion);
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

    const [updated] = await this.db.client.$transaction([
      this.db.client.contentType.update({
        where: { id: contentTypeId },
        data: { status: "ARCHIVED" },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { version: true },
          },
        },
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

    return this.toDetail(updated, updated.versions[0]?.version ?? null);
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

  private toDetail(
    contentType: {
      id: string;
      siteId: string;
      name: string;
      slug: string;
      description: string | null;
      status: "DRAFT" | "ACTIVE" | "ARCHIVED";
      fields: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    latestVersion: number | null,
  ): ContentTypeDetail {
    return {
      id: contentType.id,
      siteId: contentType.siteId,
      name: contentType.name,
      slug: contentType.slug,
      description: contentType.description,
      status: contentType.status,
      fields: Array.isArray(contentType.fields)
        ? (contentType.fields as FieldDefinition[])
        : [],
      latestVersion,
      createdAt: contentType.createdAt,
      updatedAt: contentType.updatedAt,
    };
  }
}
