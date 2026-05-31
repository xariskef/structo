import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ContentTypeDetail,
  ContentTypeSummary,
  CreateContentTypeInput,
  UpdateContentTypeInput,
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

    return rows.map((ct) => ({
      id: ct.id,
      siteId: ct.siteId,
      name: ct.name,
      slug: ct.slug,
      status: ct.status,
      fieldCount: Array.isArray(ct.fields) ? ct.fields.length : 0,
      createdAt: ct.createdAt,
      updatedAt: ct.updatedAt,
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
      "site.manage_content",
    );

    try {
      const ct = await this.db.client.contentType.create({
        data: {
          siteId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          fields: [],
        },
      });

      await this.db.client.auditLog.create({
        data: {
          siteId,
          actorId: userId,
          action: "content_type.create",
          entityType: "ContentType",
          entityId: ct.id,
          metadata: { name: ct.name, slug: ct.slug },
        },
      });

      return this.toDetail(ct, null);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new ConflictException(
          "A content type with this slug already exists.",
        );
      }

      throw error;
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

    const ct = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { version: true },
        },
      },
    });

    if (!ct || ct.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    const latestVersion = ct.versions[0]?.version ?? null;

    return this.toDetail(ct, latestVersion);
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
      "site.manage_content",
    );

    const existing = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
    });

    if (!existing || existing.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    if (existing.status === "ARCHIVED") {
      throw new BadRequestException("Archived content types cannot be edited.");
    }

    try {
      await this.db.client.contentType.update({
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
      });

      return this.get(userId, siteId, contentTypeId);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new ConflictException(
          "A content type with this slug already exists.",
        );
      }

      throw error;
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
      "site.manage_content",
    );

    const ct = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { version: true },
        },
      },
    });

    if (!ct || ct.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    if (ct.status === "ARCHIVED") {
      throw new BadRequestException(
        "Archived content types cannot be activated.",
      );
    }

    if (!Array.isArray(ct.fields) || ct.fields.length === 0) {
      throw new BadRequestException(
        "A content type must have at least one field before activation.",
      );
    }

    const nextVersion = (ct.versions[0]?.version ?? 0) + 1;

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
          fields: ct.fields,
          createdById: userId,
        },
      }),
      this.db.client.auditLog.create({
        data: {
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
      "site.manage_content",
    );

    const ct = await this.db.client.contentType.findUnique({
      where: { id: contentTypeId },
    });

    if (!ct || ct.siteId !== siteId) {
      throw new NotFoundException("Content type not found.");
    }

    const updated = await this.db.client.contentType.update({
      where: { id: contentTypeId },
      data: { status: "ARCHIVED" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { version: true },
        },
      },
    });

    return this.toDetail(updated, updated.versions[0]?.version ?? null);
  }

  private toDetail(
    ct: {
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
      id: ct.id,
      siteId: ct.siteId,
      name: ct.name,
      slug: ct.slug,
      description: ct.description,
      status: ct.status,
      fields: Array.isArray(ct.fields) ? (ct.fields as FieldDefinition[]) : [],
      latestVersion,
      createdAt: ct.createdAt,
      updatedAt: ct.updatedAt,
    };
  }
}
