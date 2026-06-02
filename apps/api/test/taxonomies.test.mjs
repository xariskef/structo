import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  assignTaxonomyTermsSchema,
  configuredContentTypeFieldsSchema,
  createTaxonomyTermSchema,
  taxonomyDefinitionQuerySchema,
  taxonomyKindSchema,
} from "@structo/contracts";
import { TaxonomiesService } from "../dist/modules/taxonomies/taxonomies.service.js";
import { ContentTypesService } from "../dist/modules/content-types/content-types.service.js";

function authorization() {
  return { assertSitePermission() {} };
}

test("taxonomy contracts distinguish categories and tags", () => {
  assert.ok(taxonomyKindSchema.safeParse("CATEGORY").success);
  assert.ok(taxonomyKindSchema.safeParse("TAG").success);
  assert.ok(!taxonomyKindSchema.safeParse("OTHER").success);
  assert.ok(
    taxonomyDefinitionQuerySchema.safeParse({ scope: "PAGES" }).success,
  );
  assert.ok(
    taxonomyDefinitionQuerySchema.safeParse({
      scope: "CONTENT_TYPE",
      contentTypeId: "articles",
    }).success,
  );
  assert.ok(
    !taxonomyDefinitionQuerySchema.safeParse({ scope: "CONTENT_TYPE" }).success,
  );
  assert.ok(
    createTaxonomyTermSchema.safeParse({
      name: "News",
      slug: "news",
    }).success,
  );
  assert.ok(
    !assignTaxonomyTermsSchema.safeParse({ termIds: ["t1", "t1"] }).success,
  );
});

test("configured taxonomy fields reject incomplete immediately-active schemas", () => {
  assert.ok(configuredContentTypeFieldsSchema.safeParse([]).success);
  assert.ok(
    !configuredContentTypeFieldsSchema.safeParse([
      {
        id: "theme",
        key: "theme",
        label: "Theme",
        type: "select",
        required: false,
        config: {},
      },
    ]).success,
  );
});

test("tags reject hierarchical parents", async () => {
  const client = {
    taxonomyDefinition: {
      findUnique() {
        return {
          id: "tag-definition",
          siteId: "site-a",
          kind: "TAG",
          fields: [],
          site: { organizationId: "org" },
          versions: [{ id: "tag-definition-v1", version: 1 }],
        };
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.create("u", "site-a", "tag-definition", {
      name: "Featured",
      slug: "featured",
      parentId: "parent",
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("categories reject circular ancestry", async () => {
  const client = {
    taxonomyTerm: {
      findUnique() {
        return {
          id: "category-a",
          siteId: "site-a",
          kind: "CATEGORY",
          taxonomyDefinition: {
            id: "category-definition",
            kind: "CATEGORY",
            fields: [],
            site: { organizationId: "org" },
            versions: [{ id: "category-definition-v1", version: 1 }],
          },
        };
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.update("u", "site-a", "category-a", { parentId: "category-a" }),
    (error) => error instanceof BadRequestException,
  );
});

test("entry taxonomy assignments reject terms from another site", async () => {
  const client = {
    contentEntry: {
      findUnique() {
        return {
          id: "entry-a",
          siteId: "site-a",
          status: "DRAFT",
          site: { organizationId: "org" },
          contentType: {
            id: "ct-a",
            kind: "COLLECTION",
            status: "ACTIVE",
            taxonomies: [{ taxonomy: "TAG" }],
          },
        };
      },
    },
    taxonomyTerm: {
      findMany() {
        return [
          {
            id: "tag-a",
            siteId: "site-a",
            kind: "TAG",
            taxonomyDefinition: { scopeKey: "content-type:ct-a" },
          },
        ];
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.assignEntryTerms("u", "site-a", "entry-a", {
      termIds: ["tag-a", "tag-other-site"],
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("entry taxonomy assignments reject disabled taxonomies", async () => {
  const client = {
    contentEntry: {
      findUnique() {
        return {
          id: "entry-a",
          siteId: "site-a",
          status: "DRAFT",
          site: { organizationId: "org" },
          contentType: {
            id: "ct-a",
            kind: "COLLECTION",
            status: "ACTIVE",
            taxonomies: [{ taxonomy: "TAG" }],
          },
        };
      },
    },
    taxonomyTerm: {
      findMany() {
        return [
          {
            id: "category-a",
            siteId: "site-a",
            kind: "CATEGORY",
            taxonomyDefinition: { scopeKey: "content-type:ct-a" },
          },
        ];
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.assignEntryTerms("u", "site-a", "entry-a", {
      termIds: ["category-a"],
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("archived content rejects taxonomy assignments", async () => {
  const client = {
    contentEntry: {
      findUnique() {
        return {
          id: "entry-a",
          siteId: "site-a",
          status: "DRAFT",
          site: { organizationId: "org" },
          contentType: {
            id: "ct-a",
            kind: "COLLECTION",
            status: "ARCHIVED",
            taxonomies: [{ taxonomy: "TAG" }],
          },
        };
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.assignEntryTerms("u", "site-a", "entry-a", { termIds: [] }),
    (error) => error instanceof BadRequestException,
  );
});

test("entry taxonomy assignments reject another collection scope", async () => {
  const client = {
    contentEntry: {
      findUnique() {
        return {
          id: "entry-a",
          siteId: "site-a",
          status: "DRAFT",
          site: { organizationId: "org" },
          contentType: {
            id: "articles",
            kind: "COLLECTION",
            status: "ACTIVE",
            taxonomies: [{ taxonomy: "TAG" }],
          },
        };
      },
    },
    taxonomyTerm: {
      findMany() {
        return [
          {
            id: "services-tag",
            siteId: "site-a",
            kind: "TAG",
            taxonomyDefinition: { scopeKey: "content-type:services" },
          },
        ];
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.assignEntryTerms("u", "site-a", "entry-a", {
      termIds: ["services-tag"],
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("taxonomy terms validate required custom fields", async () => {
  const client = {
    taxonomyDefinition: {
      findUnique() {
        return {
          id: "category-definition",
          siteId: "site-a",
          kind: "CATEGORY",
          fields: [
            {
              id: "icon-field",
              key: "icon",
              label: "Icon",
              type: "text",
              required: true,
              config: {},
            },
          ],
          site: { organizationId: "org" },
          versions: [{ id: "category-definition-v1", version: 1 }],
        };
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.create("u", "site-a", "category-definition", {
      name: "News",
      slug: "news",
      data: {},
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("taxonomy updates reject undeclared keys outside schema migration", async () => {
  const client = {
    taxonomyTerm: {
      findUnique() {
        return {
          id: "category-a",
          siteId: "site-a",
          taxonomyDefinitionVersionId: "category-definition-v1",
          data: { icon: "news" },
          taxonomyDefinition: {
            id: "category-definition",
            kind: "CATEGORY",
            fields: [
              {
                id: "icon-field",
                key: "icon",
                label: "Icon",
                type: "text",
                required: true,
                config: {},
              },
            ],
            site: { organizationId: "org" },
            versions: [{ id: "category-definition-v1", version: 1 }],
          },
        };
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await assert.rejects(
    service.update("u", "site-a", "category-a", {
      data: { icon: "news", undeclared: "drop-me" },
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("taxonomy updates prune removed keys during schema migration", async () => {
  let updateData;
  const now = new Date();
  const client = {
    taxonomyTerm: {
      findUnique() {
        return {
          id: "category-a",
          siteId: "site-a",
          taxonomyDefinitionVersionId: "category-definition-v1",
          data: { icon: "news", removed: "drop-me" },
          taxonomyDefinition: {
            id: "category-definition",
            kind: "CATEGORY",
            fields: [
              {
                id: "icon-field",
                key: "icon",
                label: "Icon",
                type: "text",
                required: true,
                config: {},
              },
            ],
            site: { organizationId: "org" },
            versions: [{ id: "category-definition-v2", version: 2 }],
          },
        };
      },
    },
    $transaction(callback) {
      return callback({
        taxonomyTerm: {
          update({ data }) {
            updateData = data;
            return {
              id: "category-a",
              siteId: "site-a",
              taxonomyDefinitionId: "category-definition",
              taxonomyDefinitionVersionId: data.taxonomyDefinitionVersionId,
              kind: "CATEGORY",
              name: "News",
              slug: "news",
              description: null,
              seoTitle: null,
              seoDescription: null,
              data: data.data,
              parentId: null,
              createdAt: now,
              updatedAt: now,
              _count: { entries: 0 },
            };
          },
        },
        auditLog: { create() {} },
      });
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  await service.update("u", "site-a", "category-a", {});

  assert.deepEqual(updateData.data, { icon: "news" });
  assert.equal(
    updateData.taxonomyDefinitionVersionId,
    "category-definition-v2",
  );
});

test("taxonomy summaries omit internal prisma count metadata", async () => {
  const now = new Date();
  const client = {
    taxonomyDefinition: {
      findUnique() {
        return {
          id: "category-definition",
          siteId: "site-a",
          kind: "CATEGORY",
          fields: [],
          site: { organizationId: "org" },
          versions: [{ id: "category-definition-v1", version: 1 }],
        };
      },
    },
    taxonomyTerm: {
      findMany() {
        return [
          {
            id: "category-a",
            siteId: "site-a",
            taxonomyDefinitionId: "category-definition",
            taxonomyDefinitionVersionId: "category-definition-v1",
            kind: "CATEGORY",
            name: "News",
            slug: "news",
            description: null,
            seoTitle: null,
            seoDescription: null,
            data: {},
            parentId: null,
            createdAt: now,
            updatedAt: now,
            _count: { entries: 2 },
          },
        ];
      },
    },
  };
  const service = new TaxonomiesService({ client }, authorization());

  const [term] = await service.list("u", "site-a", "category-definition");

  assert.equal(term.itemCount, 2);
  assert.ok(!("_count" in term));
});

test("disabling a content type taxonomy removes stale assignments", async () => {
  let deleteWhere;
  const client = {
    contentType: {
      findUnique() {
        return {
          id: "ct-a",
          siteId: "site-a",
          status: "ACTIVE",
          site: { organizationId: "org" },
        };
      },
      update() {
        return {};
      },
    },
    contentTypeTaxonomy: {
      deleteMany() {
        return {};
      },
      create() {
        return {};
      },
    },
    contentEntryTaxonomyTerm: {
      deleteMany({ where }) {
        deleteWhere = where;
        return {};
      },
    },
    auditLog: {
      create() {
        return {};
      },
    },
    $transaction(values) {
      return Promise.all(values);
    },
  };
  const service = new ContentTypesService({ client }, authorization(), {});
  service.get = async () => ({});

  await service.update("u", "site-a", "ct-a", { taxonomies: ["TAG"] });

  assert.deepEqual(deleteWhere, {
    entry: { contentTypeId: "ct-a" },
    term: { kind: { notIn: ["TAG"] } },
  });
});
