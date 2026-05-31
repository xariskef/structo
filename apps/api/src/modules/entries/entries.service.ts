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
import { buildEntryDataSchema } from "@structo/field-kit";
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
      include: { contentType: { select: { name: true } } },
    });

    return rows.map((e) => ({
      id: e.id,
      siteId: e.siteId,
      contentTypeId: e.contentTypeId,
      contentTypeName: e.contentType.name,
      title: e.title,
      slug: e.slug,
      status: e.status,
      publishedAt: e.publishedAt,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
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
      "site.manage_content",
    );

    // Resolve the active version of the content type
    const activeVersion = await this.resolveActiveVersion(input.contentTypeId, siteId);
    const fields = activeVersion.fields as unknown as FieldDefinition[];

    // Validate entry data against the field schema
    this.validateData(fields, input.data);

    try {
      const entry = await this.db.client.contentEntry.create({
        data: {
          siteId,
          contentTypeId: input.contentTypeId,
          contentTypeVersionId: activeVersion.id,
          title: input.title,
          slug: input.slug,
          data: JSON.parse(JSON.stringify(input.data)),
          createdById: userId,
          updatedById: userId,
        },
        include: {
          contentType: { select: { name: true } },
          revisions: { orderBy: { revision: "desc" }, take: 1, select: { revision: true } },
        },
      });

      await this.db.client.auditLog.create({
        data: {
          siteId,
          actorId: userId,
          action: "entry.create",
          entityType: "ContentEntry",
          entityId: entry.id,
          metadata: { title: entry.title, contentTypeId: entry.contentTypeId },
        },
      });

      return this.toDetail(entry, null);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new ConflictException("An entry with this slug already exists for this content type.");
      }
      throw error;
    }
  }

  async get(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(userId, siteId, "site.view");

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        contentType: { select: { name: true } },
        revisions: { orderBy: { revision: "desc" }, take: 1, select: { revision: true } },
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
    await this.authorizationService.assertSitePermission(userId, siteId, "site.manage_content");

    const existing = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing || existing.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (existing.status === "ARCHIVED") {
      throw new BadRequestException("Archived entries cannot be edited.");
    }

    // Validate new data if provided
    if (input.data !== undefined) {
      const activeVersion = await this.resolveActiveVersion(existing.contentTypeId, siteId);
      const fields = activeVersion.fields as unknown as FieldDefinition[];
      this.validateData(fields, input.data);
    }

    try {
      await this.db.client.contentEntry.update({
        where: { id: entryId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.data !== undefined ? { data: JSON.parse(JSON.stringify(input.data)) } : {}),
          updatedById: userId,
        },
      });

      return this.get(userId, siteId, entryId);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
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
    await this.authorizationService.assertSitePermission(userId, siteId, "site.manage_content");

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        revisions: { orderBy: { revision: "desc" }, take: 1, select: { revision: true } },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (entry.status === "ARCHIVED") {
      throw new BadRequestException("Archived entries cannot be published.");
    }

    const nextRevision = (entry.revisions[0]?.revision ?? 0) + 1;

    await this.db.client.$transaction([
      this.db.client.contentEntry.update({
        where: { id: entryId },
        data: { status: "PUBLISHED", publishedAt: new Date(), updatedById: userId },
      }),
      this.db.client.contentRevision.create({
        data: {
          entryId,
          revision: nextRevision,
          data: JSON.parse(JSON.stringify(entry.data)),
          status: "PUBLISHED",
          createdById: userId,
        },
      }),
      this.db.client.auditLog.create({
        data: {
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
    await this.authorizationService.assertSitePermission(userId, siteId, "site.manage_content");

    const entry = await this.db.client.contentEntry.findUnique({ where: { id: entryId } });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (entry.status !== "PUBLISHED") {
      throw new BadRequestException("Only published entries can be unpublished.");
    }

    await this.db.client.contentEntry.update({
      where: { id: entryId },
      data: { status: "DRAFT", updatedById: userId },
    });

    return this.get(userId, siteId, entryId);
  }

  async listRevisions(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<RevisionSummary[]> {
    await this.authorizationService.assertSitePermission(userId, siteId, "site.view");

    const entry = await this.db.client.contentEntry.findUnique({ where: { id: entryId } });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    const revisions = await this.db.client.contentRevision.findMany({
      where: { entryId },
      orderBy: { revision: "desc" },
    });

    return revisions.map((r) => ({
      id: r.id,
      revision: r.revision,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async resolveActiveVersion(contentTypeId: string, siteId: string) {
    const version = await this.db.client.contentTypeVersion.findFirst({
      where: { contentTypeId },
      orderBy: { version: "desc" },
    });

    if (!version) {
      throw new BadRequestException(
        "The content type has no active version. Activate it first.",
      );
    }

    return version;
  }

  private validateData(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
  ): void {
    const schema = buildEntryDataSchema(fields);
    const result = schema.safeParse(data);

    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Entry data is invalid: ${messages}`);
    }
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
      contentType: { name: string };
    },
    latestRevision: number | null,
  ): EntryDetail {
    return {
      id: entry.id,
      siteId: entry.siteId,
      contentTypeId: entry.contentTypeId,
      contentTypeVersionId: entry.contentTypeVersionId,
      contentTypeName: entry.contentType.name,
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      data: (entry.data as Record<string, unknown>) ?? {},
      publishedAt: entry.publishedAt,
      latestRevision,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
