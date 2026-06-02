import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  configuredContentTypeFieldsSchema,
  type AssignTaxonomyTermsInput,
  type CreateTaxonomyTermInput,
  type TaxonomyDefinitionDetail,
  type TaxonomyDefinitionQuery,
  type TaxonomyKind,
  type TaxonomyTermSummary,
  type UpdateTaxonomyDefinitionInput,
  type UpdateTaxonomyTermInput,
} from "@structo/contracts";
import { buildEntryDataSchema, type FieldDefinition } from "@structo/field-kit";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";
import { assertSiteMediaAssets } from "../media/media-references.js";

@Injectable()
export class TaxonomiesService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async listDefinitions(
    userId: string,
    siteId: string,
    query: TaxonomyDefinitionQuery,
  ): Promise<TaxonomyDefinitionDetail[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );
    const scopeKey = await this.resolveScopeKey(siteId, query);
    const definitions = await this.db.client.taxonomyDefinition.findMany({
      where: { siteId, scopeKey },
      include: {
        versions: {
          select: { version: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: { kind: "asc" },
    });
    return definitions.map((definition) => this.toDefinition(definition));
  }

  async updateDefinition(
    userId: string,
    siteId: string,
    definitionId: string,
    input: UpdateTaxonomyDefinitionInput,
  ): Promise<TaxonomyDefinitionDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_taxonomies",
    );
    const fields = this.validateFieldSchema(input.fields);
    const definition = await this.findDefinition(definitionId, siteId);
    const latestVersion = definition.versions[0]?.version ?? 0;

    await this.db.client.$transaction([
      this.db.client.taxonomyDefinition.update({
        where: { id: definitionId },
        data: { fields: this.toJson(fields) },
      }),
      this.db.client.taxonomyDefinitionVersion.create({
        data: {
          taxonomyDefinitionId: definitionId,
          version: latestVersion + 1,
          fields: this.toJson(fields),
          createdById: userId,
        },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: definition.site.organizationId,
          siteId,
          actorId: userId,
          action: "taxonomy_definition.update",
          entityType: "TaxonomyDefinition",
          entityId: definitionId,
          metadata: { kind: definition.kind, version: latestVersion + 1 },
        },
      }),
    ]);

    return this.getDefinition(userId, siteId, definitionId);
  }

  async getDefinition(
    userId: string,
    siteId: string,
    definitionId: string,
  ): Promise<TaxonomyDefinitionDetail> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );
    return this.toDefinition(await this.findDefinition(definitionId, siteId));
  }

  async list(
    userId: string,
    siteId: string,
    definitionId: string,
  ): Promise<TaxonomyTermSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );
    await this.findDefinition(definitionId, siteId);
    const terms = await this.db.client.taxonomyTerm.findMany({
      where: { siteId, taxonomyDefinitionId: definitionId },
      include: { _count: { select: { entries: true } } },
      orderBy: { name: "asc" },
    });
    return terms.map((term) => this.toSummary(term));
  }

  async create(
    userId: string,
    siteId: string,
    definitionId: string,
    input: CreateTaxonomyTermInput,
  ): Promise<TaxonomyTermSummary> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_taxonomies",
    );
    const definition = await this.findDefinition(definitionId, siteId);
    const latestVersion = this.latestDefinitionVersion(definition);
    await this.assertValidParent(definitionId, definition.kind, input.parentId);
    const data = this.validateData(
      this.toFields(definition.fields),
      input.data,
    );
    await assertSiteMediaAssets(
      this.db,
      siteId,
      this.toFields(definition.fields),
      data,
    );

    try {
      const term = await this.db.client.$transaction(async (transaction) => {
        const created = await transaction.taxonomyTerm.create({
          data: {
            siteId,
            taxonomyDefinitionId: definitionId,
            taxonomyDefinitionVersionId: latestVersion.id,
            kind: definition.kind,
            name: input.name,
            slug: input.slug,
            description: input.description ?? null,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
            data: this.toJson(data),
            parentId: input.parentId ?? null,
          },
          include: { _count: { select: { entries: true } } },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: definition.site.organizationId,
            siteId,
            actorId: userId,
            action: "taxonomy_term.create",
            entityType: "TaxonomyTerm",
            entityId: created.id,
            metadata: {
              taxonomyDefinitionId: definition.id,
              kind: created.kind,
              name: created.name,
              slug: created.slug,
            },
          },
        });
        return created;
      });
      return this.toSummary(term);
    } catch (error: unknown) {
      this.throwSlugConflict(error);
    }
  }

  async update(
    userId: string,
    siteId: string,
    termId: string,
    input: UpdateTaxonomyTermInput,
  ): Promise<TaxonomyTermSummary> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_taxonomies",
    );
    const term = await this.db.client.taxonomyTerm.findUnique({
      where: { id: termId },
      include: {
        taxonomyDefinition: {
          include: {
            site: { select: { organizationId: true } },
            versions: { orderBy: { version: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!term || term.siteId !== siteId) {
      throw new NotFoundException("Taxonomy term not found.");
    }
    const definition = term.taxonomyDefinition;
    const latestVersion = this.latestDefinitionVersion(definition);
    await this.assertValidParent(
      definition.id,
      definition.kind,
      input.parentId,
      termId,
    );
    const fields = this.toFields(definition.fields);
    const currentData = this.toData(input.data ?? term.data);
    const isMigrating = term.taxonomyDefinitionVersionId !== latestVersion.id;
    const nextData = isMigrating
      ? this.projectData(fields, currentData)
      : currentData;
    const data = this.validateData(fields, nextData);
    await assertSiteMediaAssets(this.db, siteId, fields, data);

    try {
      const updated = await this.db.client.$transaction(async (transaction) => {
        const next = await transaction.taxonomyTerm.update({
          where: { id: termId },
          data: {
            ...input,
            data: this.toJson(data),
            taxonomyDefinitionVersionId: latestVersion.id,
          },
          include: { _count: { select: { entries: true } } },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: definition.site.organizationId,
            siteId,
            actorId: userId,
            action: "taxonomy_term.update",
            entityType: "TaxonomyTerm",
            entityId: termId,
            metadata: { updatedFields: Object.keys(input) },
          },
        });
        return next;
      });
      return this.toSummary(updated);
    } catch (error: unknown) {
      this.throwSlugConflict(error);
    }
  }

  async remove(userId: string, siteId: string, termId: string): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_taxonomies",
    );
    const term = await this.db.client.taxonomyTerm.findUnique({
      where: { id: termId },
      include: {
        taxonomyDefinition: {
          include: { site: { select: { organizationId: true } } },
        },
        _count: { select: { children: true } },
      },
    });
    if (!term || term.siteId !== siteId) {
      throw new NotFoundException("Taxonomy term not found.");
    }
    if (term._count.children > 0) {
      throw new BadRequestException("Move or delete child categories first.");
    }

    await this.db.client.$transaction([
      this.db.client.taxonomyTerm.delete({ where: { id: termId } }),
      this.db.client.auditLog.create({
        data: {
          organizationId: term.taxonomyDefinition.site.organizationId,
          siteId,
          actorId: userId,
          action: "taxonomy_term.delete",
          entityType: "TaxonomyTerm",
          entityId: termId,
          metadata: { kind: term.kind, name: term.name },
        },
      }),
    ]);
  }

  async listAvailableForEntry(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<TaxonomyTermSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );
    const entry = await this.findEntry(entryId, siteId);
    const enabled = entry.contentType.taxonomies.map(
      ({ taxonomy }) => taxonomy,
    );
    if (enabled.length === 0) return [];
    const terms = await this.db.client.taxonomyTerm.findMany({
      where: {
        siteId,
        kind: { in: enabled },
        taxonomyDefinition: {
          scopeKey: this.entryScopeKey(entry.contentType),
        },
      },
      include: { _count: { select: { entries: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    return terms.map((term) => this.toSummary(term));
  }

  async listEntryTerms(
    userId: string,
    siteId: string,
    entryId: string,
  ): Promise<TaxonomyTermSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );
    await this.findEntry(entryId, siteId);
    const terms = await this.db.client.taxonomyTerm.findMany({
      where: { siteId, entries: { some: { entryId } } },
      include: { _count: { select: { entries: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    return terms.map((term) => this.toSummary(term));
  }

  async assignEntryTerms(
    userId: string,
    siteId: string,
    entryId: string,
    input: AssignTaxonomyTermsInput,
  ): Promise<TaxonomyTermSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.edit_content",
    );
    const entry = await this.findEntry(entryId, siteId);
    if (
      entry.status === "ARCHIVED" ||
      entry.contentType.status === "ARCHIVED"
    ) {
      throw new BadRequestException(
        "Archived content cannot receive taxonomy terms.",
      );
    }
    const terms = await this.db.client.taxonomyTerm.findMany({
      where: { id: { in: input.termIds }, siteId },
      include: { taxonomyDefinition: { select: { scopeKey: true } } },
    });
    if (terms.length !== input.termIds.length) {
      throw new BadRequestException(
        "Some taxonomy terms do not belong to this site.",
      );
    }
    const enabled = new Set(
      entry.contentType.taxonomies.map(({ taxonomy }) => taxonomy),
    );
    const scopeKey = this.entryScopeKey(entry.contentType);
    if (
      terms.some(
        (term) =>
          !enabled.has(term.kind) ||
          term.taxonomyDefinition.scopeKey !== scopeKey,
      )
    ) {
      throw new BadRequestException(
        "Some taxonomy terms are not enabled for this content type scope.",
      );
    }

    await this.db.client.$transaction([
      this.db.client.contentEntryTaxonomyTerm.deleteMany({
        where: { entryId },
      }),
      ...(input.termIds.length > 0
        ? [
            this.db.client.contentEntryTaxonomyTerm.createMany({
              data: input.termIds.map((termId) => ({
                siteId,
                entryId,
                termId,
              })),
            }),
          ]
        : []),
      this.db.client.auditLog.create({
        data: {
          organizationId: entry.site.organizationId,
          siteId,
          actorId: userId,
          action: "entry.taxonomy_terms.update",
          entityType: "ContentEntry",
          entityId: entryId,
          metadata: { termIds: input.termIds },
        },
      }),
    ]);
    return this.listEntryTerms(userId, siteId, entryId);
  }

  private async resolveScopeKey(
    siteId: string,
    query: TaxonomyDefinitionQuery,
  ): Promise<string> {
    if (query.scope === "PAGES") return "pages";
    const contentType = await this.db.client.contentType.findUnique({
      where: { id: query.contentTypeId },
      select: { siteId: true, kind: true },
    });
    if (
      !contentType ||
      contentType.siteId !== siteId ||
      contentType.kind !== "COLLECTION"
    ) {
      throw new NotFoundException("Collection not found.");
    }
    return `content-type:${query.contentTypeId}`;
  }

  private async findDefinition(definitionId: string, siteId: string) {
    const definition = await this.db.client.taxonomyDefinition.findUnique({
      where: { id: definitionId },
      include: {
        site: { select: { organizationId: true } },
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!definition || definition.siteId !== siteId) {
      throw new NotFoundException("Taxonomy definition not found.");
    }
    return definition;
  }

  private async findEntry(entryId: string, siteId: string) {
    const entry = await this.db.client.contentEntry.findUnique({
      where: { id: entryId },
      include: {
        site: { select: { organizationId: true } },
        contentType: {
          include: { taxonomies: { select: { taxonomy: true } } },
        },
      },
    });
    if (!entry || entry.siteId !== siteId) {
      throw new NotFoundException("Entry not found.");
    }
    return entry;
  }

  private entryScopeKey(contentType: {
    id: string;
    kind: "COLLECTION" | "SINGLE";
  }): string {
    return contentType.kind === "SINGLE"
      ? "pages"
      : `content-type:${contentType.id}`;
  }

  private async assertValidParent(
    definitionId: string,
    kind: TaxonomyKind,
    parentId?: string | null,
    termId?: string,
  ): Promise<void> {
    if (!parentId) return;
    if (kind !== "CATEGORY") {
      throw new BadRequestException("Tags cannot have a parent.");
    }
    const visited = new Set<string>(termId ? [termId] : []);
    let currentId: string | null = parentId;
    while (currentId) {
      if (visited.has(currentId)) {
        throw new BadRequestException("A category cannot be its own ancestor.");
      }
      visited.add(currentId);
      const parent: { parentId: string | null } | null =
        await this.db.client.taxonomyTerm.findFirst({
          where: { id: currentId, taxonomyDefinitionId: definitionId },
          select: { parentId: true },
        });
      if (!parent) {
        throw new BadRequestException(
          "Parent category not found in this taxonomy scope.",
        );
      }
      currentId = parent.parentId;
    }
  }

  private validateFieldSchema(fields: unknown[]): FieldDefinition[] {
    const result = configuredContentTypeFieldsSchema.safeParse(fields);
    if (!result.success) {
      throw new BadRequestException(
        `Taxonomy field schema is invalid: ${result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.data;
  }

  private validateData(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = buildEntryDataSchema(fields).safeParse(data);
    if (!result.success) {
      throw new BadRequestException(
        `Taxonomy term data is invalid: ${result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.data;
  }

  private projectData(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      if (!(field.key in data)) continue;
      const value = data[field.key];
      const nested = this.toFields(
        (field.config as Record<string, unknown>).fields,
      );
      if (field.type === "group" && this.isRecord(value)) {
        projected[field.key] = this.projectData(nested, value);
      } else if (field.type === "repeater" && Array.isArray(value)) {
        projected[field.key] = value.map((row) =>
          this.isRecord(row) ? this.projectData(nested, row) : row,
        );
      } else {
        projected[field.key] = value;
      }
    }
    return projected;
  }

  private latestDefinitionVersion(definition: {
    versions: { id: string; version: number }[];
  }): { id: string; version: number } {
    const version = definition.versions[0];
    if (!version) {
      throw new BadRequestException(
        "Taxonomy definition has no schema version.",
      );
    }
    return version;
  }

  private toDefinition(definition: {
    id: string;
    siteId: string;
    contentTypeId: string | null;
    scope: "PAGES" | "CONTENT_TYPE";
    scopeKey: string;
    kind: TaxonomyKind;
    fields: unknown;
    createdAt: Date;
    updatedAt: Date;
    versions: { version: number }[];
  }): TaxonomyDefinitionDetail {
    return {
      id: definition.id,
      siteId: definition.siteId,
      contentTypeId: definition.contentTypeId,
      scope: definition.scope,
      scopeKey: definition.scopeKey,
      kind: definition.kind,
      fields: this.toFields(definition.fields),
      latestVersion: definition.versions[0]?.version ?? 0,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    };
  }

  private toSummary(term: {
    id: string;
    siteId: string;
    taxonomyDefinitionId: string;
    taxonomyDefinitionVersionId: string;
    kind: TaxonomyKind;
    name: string;
    slug: string;
    description: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    data: unknown;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { entries: number };
  }): TaxonomyTermSummary {
    return {
      id: term.id,
      siteId: term.siteId,
      taxonomyDefinitionId: term.taxonomyDefinitionId,
      taxonomyDefinitionVersionId: term.taxonomyDefinitionVersionId,
      kind: term.kind,
      name: term.name,
      slug: term.slug,
      description: term.description,
      seoTitle: term.seoTitle,
      seoDescription: term.seoDescription,
      data: this.toData(term.data),
      parentId: term.parentId,
      createdAt: term.createdAt,
      updatedAt: term.updatedAt,
      itemCount: term._count.entries,
    };
  }

  private toFields(value: unknown): FieldDefinition[] {
    return Array.isArray(value) ? (value as FieldDefinition[]) : [];
  }

  private toData(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as object;
  }

  private throwSlugConflict(error: unknown): never {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new ConflictException(
        "A taxonomy term with this slug already exists in this scope.",
      );
    }
    throw error;
  }
}
