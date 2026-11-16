import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BulkEntriesInput,
  CreateEntryInput,
  EntryDetail,
  EntryStatus,
  EntrySummary,
  RevisionSummary,
  ScheduleEntryInput,
  UpdateEntryInput,
} from "@structo/contracts";
import {
  buildDraftEntryDataSchema,
  buildEntryDataSchema,
} from "@structo/field-kit";
import type { FieldDefinition } from "@structo/field-kit";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";
import { assertSiteMediaAssets } from "../media/media-references.js";
import { WebhooksService } from "../webhooks/webhooks.service.js";

@Injectable()
export class EntriesService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
    @Inject(WebhooksService)
    private readonly webhooksService: WebhooksService,
  ) {}

  async list(
    userId: string,
    siteId: string,
    contentTypeId?: string,
    status?: EntryStatus,
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
        // A specific status filter overrides the default of hiding archived.
        ...(status ? { status } : { status: { not: "ARCHIVED" } }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        contentType: { select: { name: true, kind: true, slug: true } },
      },
    });

    return rows.map((entry) => ({
      id: entry.id,
      siteId: entry.siteId,
      contentTypeId: entry.contentTypeId,
      contentTypeName: entry.contentType.name,
      contentTypeKind: entry.contentType.kind,
      contentTypeSlug: entry.contentType.slug,
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      excerpt: entry.excerpt,
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
    await assertSiteMediaAssets(this.db, siteId, fields, data);

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
              contentType: { select: { name: true, kind: true, slug: true } },
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
      throw new BadRequestException("Only single pages expose a single item.");
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
        contentType: { select: { name: true, kind: true, slug: true } },
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

    const latest = await this.latestActiveVersion(entry.contentTypeId);
    return this.toDetail(
      entry,
      entry.revisions[0]?.revision ?? null,
      latest?.fields,
    );
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

    // Validate (and re-bind) against the current active schema so fields added
    // after this entry was created are accepted and persisted.
    const latest = await this.latestActiveVersion(existing.contentTypeId);
    const versionFields = latest
      ? latest.fields
      : existing.contentTypeVersion.fields;

    const data =
      input.data === undefined
        ? undefined
        : this.validateData(
            this.toFields(versionFields),
            this.prepareSchemaMigrationData(
              this.toFields(versionFields),
              input.data,
              latest !== null && latest.id !== existing.contentTypeVersionId,
            ),
            "draft",
          );
    if (data !== undefined) {
      await assertSiteMediaAssets(
        this.db,
        siteId,
        this.toFields(versionFields),
        data,
      );
    }

    try {
      await this.db.client.$transaction([
        this.db.client.contentEntry.update({
          where: { id: entryId },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(data !== undefined ? { data: this.toJson(data) } : {}),
            ...(latest ? { contentTypeVersionId: latest.id } : {}),
            ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
            ...(input.seoTitle !== undefined
              ? { seoTitle: input.seoTitle }
              : {}),
            ...(input.seoDescription !== undefined
              ? { seoDescription: input.seoDescription }
              : {}),
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
        site: { select: { organizationId: true, key: true } },
        contentType: { select: { slug: true } },
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

    // Publish against the current active schema and migrate the entry onto it.
    const latest = await this.latestActiveVersion(entry.contentTypeId);
    const versionFields = latest
      ? latest.fields
      : entry.contentTypeVersion.fields;

    const fields = this.toFields(versionFields);
    const data = this.validateData(
      fields,
      this.prepareSchemaMigrationData(
        fields,
        this.toData(entry.data),
        latest !== null && latest.id !== entry.contentTypeVersionId,
      ),
      "publish",
    );
    await assertSiteMediaAssets(this.db, siteId, fields, data);
    const nextRevision = (entry.revisions[0]?.revision ?? 0) + 1;

    // Snapshot the current taxonomy assignments for the published revision.
    const currentTerms = await this.db.client.contentEntryTaxonomyTerm.findMany(
      {
        where: { entryId },
        include: { term: { select: { kind: true, name: true, slug: true } } },
      },
    );

    const publishedAt = new Date();
    const contentTypeVersionId = latest?.id ?? entry.contentTypeVersionId;
    await this.db.client.$transaction(async (tx) => {
      const revision = await tx.contentRevision.create({
        data: {
          entryId,
          contentTypeVersionId,
          revision: nextRevision,
          data: this.toJson(data),
          status: "PUBLISHED",
          title: entry.title,
          slug: entry.slug,
          excerpt: entry.excerpt,
          seoTitle: entry.seoTitle,
          seoDescription: entry.seoDescription,
          publishedAt,
          createdById: userId,
          terms: {
            create: currentTerms.map(({ termId, term }) => ({
              termId,
              kind: term.kind as string,
              name: term.name,
              slug: term.slug,
            })),
          },
        },
        select: { id: true },
      });

      await tx.contentEntry.update({
        where: { id: entryId },
        data: {
          data: this.toJson(data),
          status: "PUBLISHED",
          publishedAt,
          publishedRevisionId: revision.id,
          ...(latest ? { contentTypeVersionId: latest.id } : {}),
          updatedById: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: entry.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.publish",
          entityType: "ContentEntry",
          entityId: entryId,
          metadata: { revision: nextRevision },
        },
      });
    });

    this.webhooksService.dispatch(entry.site.key, siteId, "entry.published", {
      id: entryId,
      contentTypeSlug: entry.contentType.slug,
      slug: entry.slug,
      title: entry.title,
      status: "published",
    });

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
        site: { select: { organizationId: true, key: true } },
        contentType: { select: { kind: true, slug: true } },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (
      entry.status !== "PUBLISHED" &&
      !(entry.status === "SCHEDULED" && entry.publishedRevisionId !== null)
    ) {
      throw new BadRequestException(
        "Only published entries can be unpublished.",
      );
    }

    await this.db.client.$transaction([
      this.db.client.contentEntry.update({
        where: { id: entryId },
        data: {
          status: "DRAFT",
          publishedRevisionId: null,
          updatedById: userId,
        },
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

    this.webhooksService.dispatch(entry.site.key, siteId, "entry.unpublished", {
      id: entryId,
      contentTypeSlug: entry.contentType.slug,
      slug: entry.slug,
      title: entry.title,
      status: "draft",
    });

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
        data: {
          status: "ARCHIVED",
          publishedRevisionId: null,
          updatedById: userId,
        },
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

  async duplicate(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.create_content",
    );

    const source = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        site: { select: { organizationId: true } },
        contentType: { select: { kind: true } },
      },
    });

    if (!source || source.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (source.contentType.kind === "SINGLE") {
      throw new BadRequestException("Single pages cannot be duplicated.");
    }

    const slug = await this.uniqueSlug(
      source.contentTypeId,
      `${source.slug}-copy`,
    );

    const created = await this.db.client.$transaction(async (transaction) => {
      const copy = await transaction.contentEntry.create({
        data: {
          siteId,
          contentTypeId: source.contentTypeId,
          contentTypeVersionId: source.contentTypeVersionId,
          title: `${source.title} (copy)`,
          slug,
          data: source.data as object,
          excerpt: source.excerpt,
          seoTitle: source.seoTitle,
          seoDescription: source.seoDescription,
          status: "DRAFT",
          createdById: userId,
          updatedById: userId,
        },
        include: {
          contentType: { select: { name: true, kind: true, slug: true } },
          contentTypeVersion: { select: { fields: true } },
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: source.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.duplicate",
          entityType: "ContentEntry",
          entityId: copy.id,
          metadata: { sourceId: source.id },
        },
      });

      return copy;
    });

    return this.toDetail(created, null);
  }

  async remove(userId: string, siteId: string, entryId: string): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.publish_content",
    );

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        site: { select: { organizationId: true, key: true } },
        contentType: { select: { kind: true, slug: true } },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }

    if (entry.contentType.kind === "SINGLE") {
      throw new BadRequestException(
        "Single page content cannot be deleted. Archive the page instead.",
      );
    }

    await this.db.client.$transaction(async (tx) => {
      // Clear publishedRevisionId first to break the circular FK before
      // the cascade-delete fires on ContentRevision rows.
      await tx.contentEntry.update({
        where: { id: entryId },
        data: { publishedRevisionId: null },
      });
      await tx.contentEntry.delete({ where: { id: entryId } });
      await tx.auditLog.create({
        data: {
          organizationId: entry.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.delete",
          entityType: "ContentEntry",
          entityId: entryId,
          metadata: { title: entry.title },
        },
      });
    });

    this.webhooksService.dispatch(entry.site.key, siteId, "entry.deleted", {
      id: entryId,
      contentTypeSlug: entry.contentType.slug,
      slug: entry.slug,
      title: entry.title,
      status: "deleted",
    });
  }

  // Applies one action across many entries, reusing the single-entry logic so
  // validation, revisions and audit events stay consistent. Per-item failures
  // are tolerated and counted.
  async bulk(
    userId: string,
    siteId: string,
    input: BulkEntriesInput,
  ): Promise<{ affected: number; failed: number }> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.publish_content",
    );

    const owned = await this.db.client.contentEntry.findMany({
      where: { id: { in: input.entryIds }, siteId },
      select: { id: true },
    });
    if (owned.length !== input.entryIds.length) {
      throw new BadRequestException("Some entries do not belong to this site.");
    }

    let affected = 0;
    let failed = 0;
    for (const id of input.entryIds) {
      try {
        if (input.action === "publish") {
          await this.publish(userId, siteId, id);
        } else if (input.action === "unpublish") {
          await this.unpublish(userId, siteId, id);
        } else if (input.action === "archive") {
          await this.archive(userId, siteId, id);
        } else {
          await this.remove(userId, siteId, id);
        }
        affected += 1;
      } catch {
        failed += 1;
      }
    }

    return { affected, failed };
  }

  async schedule(
    userId: string,
    siteId: string,
    entryId: string,
    input: ScheduleEntryInput,
  ): Promise<EntryDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.publish_content",
    );

    const when = new Date(input.publishAt);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException("Invalid schedule date.");
    }
    if (when.getTime() <= Date.now()) {
      throw new BadRequestException("Schedule time must be in the future.");
    }

    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        site: { select: { organizationId: true, key: true } },
        contentType: { select: { slug: true } },
        contentTypeVersion: { select: { fields: true } },
      },
    });

    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }
    if (entry.status === "ARCHIVED") {
      throw new BadRequestException("Archived entries cannot be scheduled.");
    }

    // Don't allow scheduling content that could not be published; validate and
    // migrate onto the current active schema.
    const latest = await this.latestActiveVersion(entry.contentTypeId);
    const versionFields = latest
      ? latest.fields
      : entry.contentTypeVersion.fields;
    const fields = this.toFields(versionFields);
    const data = this.validateData(
      fields,
      this.prepareSchemaMigrationData(
        fields,
        this.toData(entry.data),
        latest !== null && latest.id !== entry.contentTypeVersionId,
      ),
      "publish",
    );
    await assertSiteMediaAssets(this.db, siteId, fields, data);

    await this.db.client.$transaction([
      this.db.client.contentEntry.update({
        where: { id: entryId },
        data: {
          status: "SCHEDULED",
          publishedAt: when,
          data: this.toJson(data),
          ...(latest ? { contentTypeVersionId: latest.id } : {}),
          updatedById: userId,
        },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: entry.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.schedule",
          entityType: "ContentEntry",
          entityId: entryId,
          metadata: { publishAt: when.toISOString() },
        },
      }),
    ]);

    this.webhooksService.dispatch(entry.site.key, siteId, "entry.scheduled", {
      id: entryId,
      contentTypeSlug: entry.contentType.slug,
      slug: entry.slug,
      title: entry.title,
      status: "scheduled",
    });

    return this.get(userId, siteId, entryId);
  }

  // Promotes scheduled entries whose time has arrived. Called by the worker.
  async promoteDueScheduled(): Promise<number> {
    const due = await this.db.client.contentEntry.findMany({
      where: { status: "SCHEDULED", publishedAt: { lte: new Date() } },
      select: { id: true },
    });

    let promoted = 0;
    for (const { id } of due) {
      const claimed = await this.db.client.$transaction(async (transaction) => {
        const result = await transaction.contentEntry.updateMany({
          where: { id, status: "SCHEDULED", publishedAt: { lte: new Date() } },
          data: { status: "PUBLISHED" },
        });
        if (result.count === 0) {
          return false;
        }

        const entry = await transaction.contentEntry.findUnique({
          where: { id },
          select: {
            siteId: true,
            contentTypeVersionId: true,
            title: true,
            slug: true,
            excerpt: true,
            seoTitle: true,
            seoDescription: true,
            publishedAt: true,
            data: true,
            site: { select: { organizationId: true } },
            revisions: {
              orderBy: { revision: "desc" },
              take: 1,
              select: { revision: true },
            },
            taxonomyTerms: {
              include: {
                term: { select: { kind: true, name: true, slug: true } },
              },
            },
          },
        });
        if (!entry) {
          throw new Error("Scheduled entry disappeared after promotion.");
        }

        const revision = (entry.revisions[0]?.revision ?? 0) + 1;
        const createdRevision = await transaction.contentRevision.create({
          data: {
            entryId: id,
            contentTypeVersionId: entry.contentTypeVersionId,
            revision,
            data: this.toJson(this.toData(entry.data)),
            status: "PUBLISHED",
            title: entry.title,
            slug: entry.slug,
            excerpt: entry.excerpt,
            seoTitle: entry.seoTitle,
            seoDescription: entry.seoDescription,
            publishedAt: entry.publishedAt!,
            createdById: null,
            terms: {
              create: entry.taxonomyTerms.map(({ termId, term }) => ({
                termId,
                kind: term.kind as string,
                name: term.name,
                slug: term.slug,
              })),
            },
          },
          select: { id: true },
        });

        await transaction.contentEntry.update({
          where: { id },
          data: { publishedRevisionId: createdRevision.id },
        });

        await transaction.auditLog.create({
          data: {
            organizationId: entry.site.organizationId,
            siteId: entry.siteId,
            actorId: null,
            action: "entry.publish_scheduled",
            entityType: "ContentEntry",
            entityId: id,
            metadata: { revision },
          },
        });
        return true;
      });
      if (claimed) {
        promoted += 1;
      }
    }

    return promoted;
  }

  private async uniqueSlug(
    contentTypeId: string,
    base: string,
  ): Promise<string> {
    let candidate = base;
    let suffix = 1;
    // Slugs are unique per content type.
    while (
      await this.db.client.contentEntry.findFirst({
        where: { contentTypeId, slug: candidate },
        select: { id: true },
      })
    ) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
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

  // The newest ACTIVE schema version for a content type, or null if the type
  // is not currently active. Used so the editor always reflects the current
  // fields (newly added fields appear immediately) and writes migrate the entry
  // onto that version.
  private async latestActiveVersion(
    contentTypeId: string,
  ): Promise<{ id: string; fields: unknown } | null> {
    const contentType = await this.db.client.contentType.findFirst({
      where: { id: contentTypeId, status: "ACTIVE" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, fields: true },
        },
      },
    });
    const version = contentType?.versions[0];
    return version ? { id: version.id, fields: version.fields } : null;
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

  // When an entry moves onto a newer schema version, removed fields must not
  // block its next save. Unknown keys still fail validation on normal writes.
  private prepareSchemaMigrationData(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
    isMigration: boolean,
  ): Record<string, unknown> {
    if (!isMigration) {
      return data;
    }

    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      if (!(field.key in data)) {
        continue;
      }

      const value = data[field.key];
      if (
        field.type === "group" &&
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        projected[field.key] = this.prepareSchemaMigrationData(
          (field.config as { fields: FieldDefinition[] }).fields,
          value as Record<string, unknown>,
          true,
        );
      } else if (field.type === "repeater" && Array.isArray(value)) {
        const nestedFields = (field.config as { fields: FieldDefinition[] })
          .fields;
        projected[field.key] = value.map((row) =>
          typeof row === "object" && row !== null && !Array.isArray(row)
            ? this.prepareSchemaMigrationData(
                nestedFields,
                row as Record<string, unknown>,
                true,
              )
            : row,
        );
      } else {
        projected[field.key] = value;
      }
    }

    return projected;
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
      status: EntryStatus;
      data: unknown;
      excerpt: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      contentType: {
        name: string;
        kind: "COLLECTION" | "SINGLE";
        slug: string;
      };
      contentTypeVersion: { fields: unknown };
    },
    latestRevision: number | null,
    fieldsOverride?: unknown,
  ): EntryDetail {
    return {
      id: entry.id,
      siteId: entry.siteId,
      contentTypeId: entry.contentTypeId,
      contentTypeVersionId: entry.contentTypeVersionId,
      contentTypeName: entry.contentType.name,
      contentTypeKind: entry.contentType.kind,
      contentTypeSlug: entry.contentType.slug,
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      data: this.toData(entry.data),
      // Prefer the current active schema so newly added fields render in the
      // editor; fall back to the entry's bound version when the type is draft.
      fields: this.toFields(fieldsOverride ?? entry.contentTypeVersion.fields),
      excerpt: entry.excerpt,
      seoTitle: entry.seoTitle,
      seoDescription: entry.seoDescription,
      publishedAt: entry.publishedAt,
      latestRevision,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
