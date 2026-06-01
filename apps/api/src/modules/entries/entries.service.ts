import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateEntryInput,
  EntryDetail,
  EntrySummary,
  RevisionSummary,
  UpdateEntryInput,
} from "@structo/contracts";
import {
  buildDraftEntryDataSchema,
  buildEntryDataSchema,
} from "@structo/field-kit";
import type { FieldDefinition } from "@structo/field-kit";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class EntriesService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(
    userId: string,
    siteId: string,
    contentTypeId?: string,
  ): Promise<EntrySummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const rows = await this.db.client.contentEntry.findMany({
      where: {
        siteId,
        ...(contentTypeId ? { contentTypeId } : {}),
        status: { not: "ARCHIVED" },
      },
      orderBy: { updatedAt: "desc" },
      include: { contentType: { select: { name: true, kind: true } } },
    });

    return rows.map((entry) => ({
      id: entry.id,
      siteId: entry.siteId,
      contentTypeId: entry.contentTypeId,
      contentTypeName: entry.contentType.name,
      contentTypeKind: entry.contentType.kind,
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      publishedAt: entry.publishedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  }

  async create(
    userId: string,
    siteId: string,
    input: CreateEntryInput,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.create_content",
    );

    const activeVersion = await this.resolveActiveVersion(
      input.contentTypeId,
      siteId,
    );

    const fields = this.toFields(activeVersion.fields);
    const data = this.validateData(fields, input.data, "draft");

    try {
      const entry = await this.db.client.$transaction(
        async (transaction) => {
          // Serialize writes for a single page so concurrent first opens cannot
          // create two backing items with different slugs.
          if (activeVersion.kind === "SINGLE") {
            const existingCount = await transaction.contentEntry.count({
              where: { contentTypeId: input.contentTypeId },
            });
            if (existingCount > 0) {
              throw new ConflictException(
                "This page already has content. A single page holds exactly one item.",
              );
            }
          }

          const created = await transaction.contentEntry.create({
            data: {
              siteId,
              contentTypeId: input.contentTypeId,
              contentTypeVersionId: activeVersion.id,
              title: input.title,
              slug: input.slug,
              data: this.toJson(data),
              createdById: userId,
              updatedById: userId,
            },
            include: {
              contentType: { select: { name: true, kind: true } },
              contentTypeVersion: { select: { fields: true } },
              revisions: {
                orderBy: { revision: "desc" },
                take: 1,
                select: { revision: true },
              },
            },
          });

          await transaction.auditLog.create({
            data: {
              organizationId: activeVersion.organizationId,
              siteId,
              actorId: userId,
              action: "entry.create",
              entityType: "ContentEntry",
              entityId: created.id,
              metadata: {
                title: created.title,
                contentTypeId: created.contentTypeId,
              },
            },
          });

          return created;
        },
        activeVersion.kind === "SINGLE"
          ? { isolationLevel: "Serializable" }
          : undefined,
      );

      return this.toDetail(entry, null);
    } catch (error: unknown) {
      if (
        activeVersion.kind === "SINGLE" &&
        this.isTransactionWriteConflict(error)
      ) {
        throw new ConflictException(
          "This page already has content. A single page holds exactly one item.",
        );
      }
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new ConflictException(
          "An entry with this slug already exists for this content type.",
        );
      }
      throw error;
    }
  }

  // Single pages have exactly one backing item. Returns it, creating an empty
  // draft on first access.
  async getOrCreateSingle(
    userId: string,
    siteId: string,
    contentTypeId: string,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const contentType = await this.db.client.contentType.findFirst({
      where: { id: contentTypeId, siteId },
      select: { kind: true },
    });

    if (!contentType) {
      throw new NotFoundException("Content type not found.");
    }

    if (contentType.kind !== "SINGLE") {
      throw new BadRequestException("Only single pages expose a single item.");
    }

    const existing = await this.db.client.contentEntry.findFirst({
      where: { contentTypeId, siteId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (existing) {
      return this.get(userId, siteId, existing.id);
    }

    const activeVersion = await this.resolveActiveVersion(
      contentTypeId,
      siteId,
    );

    if (activeVersion.kind !== "SINGLE") {
      throw new BadRequestException(
        "Only single pages expose a single item.",
      );
    }

    try {
      return await this.create(userId, siteId, {
        contentTypeId,
        title: activeVersion.contentTypeName,
        slug: activeVersion.contentTypeSlug,
        data: {},
      });
    } catch (error: unknown) {
      // Two concurrent first-opens can race to create the single item.
      // If that happens, return whichever item won the race.
      if (error instanceof ConflictException) {
        const raced = await this.db.client.contentEntry.findFirst({
          where: { contentTypeId, siteId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (raced) {
          return this.get(userId, siteId, raced.id);
        }
      }
      throw error;
    }
  }

  async get(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        contentType: { select: { name: true, kind: true } },
        contentTypeVersion: { select: { fields: true } },
        revisions: {
          orderBy: { revision: "desc" },
          take: 1,
          select: { revision: true },
        },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    return this.toDetail(entry, entry.revisions[0]?.revision ?? null);
  }

  async update(
    userId: string,
    siteId: string,
    entryId: string,
    input: UpdateEntryInput,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.edit_content",
    );

    const existing = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        contentTypeVersion: { select: { fields: true } },
        site: { select: { organizationId: true } },
      },
    });

    if (!existing || existing.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (existing.status === "ARCHIVED") {
      throw new BadRequestException("Archived entries cannot be edited.");
    }

    const data =
      input.data === undefined
        ? undefined
        : this.validateData(
            this.toFields(existing.contentTypeVersion.fields),
            input.data,
            "draft",
          );

    try {
      await this.db.client.$transaction([
        this.db.client.contentEntry.update({
          where: { id: entryId },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(data !== undefined ? { data: this.toJson(data) } : {}),
            updatedById: userId,
          },
        }),
        this.db.client.auditLog.create({
          data: {
            organizationId: existing.site.organizationId,
            siteId,
            actorId: userId,
            action: "entry.update",
            entityType: "ContentEntry",
            entityId: entryId,
            metadata: { updatedFields: Object.keys(input) },
          },
        }),
      ]);

      return this.get(userId, siteId, entryId);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        throw new ConflictException("An entry with this slug already exists.");
      }
      throw error;
    }
  }

  async publish(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.publish_content",
    );

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        contentTypeVersion: { select: { fields: true } },
        site: { select: { organizationId: true } },
        revisions: {
          orderBy: { revision: "desc" },
          take: 1,
          select: { revision: true },
        },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (entry.status === "ARCHIVED") {
      throw new BadRequestException("Archived entries cannot be published.");
    }

    const data = this.validateData(
      this.toFields(entry.contentTypeVersion.fields),
      this.toData(entry.data),
      "publish",
    );
    const nextRevision = (entry.revisions[0]?.revision ?? 0) + 1;

    await this.db.client.$transaction([
      this.db.client.contentEntry.update({
        where: { id: entryId },
        data: {
          data: this.toJson(data),
          status: "PUBLISHED",
          publishedAt: new Date(),
          updatedById: userId,
        },
      }),
      this.db.client.contentRevision.create({
        data: {
          entryId,
          revision: nextRevision,
          data: this.toJson(data),
          status: "PUBLISHED",
          createdById: userId,
        },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: entry.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.publish",
          entityType: "ContentEntry",
          entityId: entryId,
          metadata: { revision: nextRevision },
        },
      }),
    ]);

    return this.get(userId, siteId, entryId);
  }

  async unpublish(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.publish_content",
    );

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        site: { select: { organizationId: true } },
        contentType: { select: { kind: true } },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (entry.status !== "PUBLISHED") {
      throw new BadRequestException(
        "Only published entries can be unpublished.",
      );
    }

    await this.db.client.$transaction([
      this.db.client.contentEntry.update({
        where: { id: entryId },
        data: { status: "DRAFT", updatedById: userId },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: entry.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.unpublish",
          entityType: "ContentEntry",
          entityId: entryId,
        },
      }),
    ]);

    return this.get(userId, siteId, entryId);
  }

  async archive(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.edit_content",
    );

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        site: { select: { organizationId: true } },
        contentType: { select: { kind: true } },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (entry.status === "ARCHIVED") {
      return this.get(userId, siteId, entryId);
    }

    if (entry.contentType.kind === "SINGLE") {
      throw new BadRequestException(
        "Single page content cannot be archived. Archive the page instead.",
      );
    }

    await this.db.client.$transaction([
      this.db.client.contentEntry.update({
        where: { id: entryId },
        data: { status: "ARCHIVED", updatedById: userId },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: entry.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.archive",
          entityType: "ContentEntry",
          entityId: entryId,
        },
      }),
    ]);

    return this.get(userId, siteId, entryId);
  }

  async listRevisions(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<RevisionSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    const revisions = await this.db.client.contentRevision.findMany({
      where: { entryId },
      orderBy: { revision: "desc" },
    });

    return revisions.map((revision) => ({
      id: revision.id,
      revision: revision.revision,
      status: revision.status,
      createdAt: revision.createdAt,
    }));
  }

  private async resolveActiveVersion(contentTypeId: string, siteId: string) {
    const contentType = await this.db.client.contentType.findFirst({
      where: { id: contentTypeId, siteId, status: "ACTIVE" },
      include: {
        site: { select: { organizationId: true } },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, fields: true },
        },
      },
    });

    const version = contentType?.versions[0];
    if (!contentType || !version) {
      throw new BadRequestException(
        "The site content type has no active version. Activate it first.",
      );
    }

    return {
      ...version,
      organizationId: contentType.site.organizationId,
      kind: contentType.kind,
      contentTypeName: contentType.name,
      contentTypeSlug: contentType.slug,
    };
  }

  private validateData(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
    mode: "draft" | "publish",
  ): Record<string, unknown> {
    const schema =
      mode === "draft"
        ? buildDraftEntryDataSchema(fields)
        : buildEntryDataSchema(fields);
    const result = schema.safeParse(data);

    if (!result.success) {
      const messages = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new BadRequestException(`Entry data is invalid: ${messages}`);
    }

    return result.data;
  }

  private toFields(fields: unknown): FieldDefinition[] {
    return Array.isArray(fields) ? (fields as FieldDefinition[]) : [];
  }

  private toData(data: unknown): Record<string, unknown> {
    return typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  }

  private toJson(data: Record<string, unknown>) {
    return JSON.parse(JSON.stringify(data));
  }

  private isTransactionWriteConflict(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    );
  }

  private toDetail(
    entry: {
      id: string;
      siteId: string;
      contentTypeId: string;
      contentTypeVersionId: string;
      title: string;
      slug: string;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      data: unknown;
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      contentType: { name: string; kind: "COLLECTION" | "SINGLE" };
      contentTypeVersion: { fields: unknown };
    },
    latestRevision: number | null,
  ): EntryDetail {
    return {
      id: entry.id,
      siteId: entry.siteId,
      contentTypeId: entry.contentTypeId,
      contentTypeVersionId: entry.contentTypeVersionId,
      contentTypeName: entry.contentType.name,
      contentTypeKind: entry.contentType.kind,
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      data: this.toData(entry.data),
      fields: this.toFields(entry.contentTypeVersion.fields),
      publishedAt: entry.publishedAt,
      latestRevision,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
