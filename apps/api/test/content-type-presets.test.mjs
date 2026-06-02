import assert from "node:assert/strict";
import test from "node:test";
import { ContentTypesService } from "../dist/modules/content-types/content-types.service.js";

function authorization() {
  return { assertSitePermission: async () => undefined };
}

function clientFixture() {
  let createData;
  let definitionCount = 0;

  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    contentType: {
      create({ data }) {
        createData = data;
        return {
          id: "ct-a",
          siteId: data.siteId,
          kind: data.kind,
          name: data.name,
          singularName: data.singularName,
          pluralName: data.pluralName,
          slug: data.slug,
          description: data.description,
          status: "DRAFT",
          fields: data.fields,
          taxonomies: data.taxonomies?.create ?? [],
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        };
      },
    },
    taxonomyDefinition: {
      create() {
        definitionCount += 1;
        return {};
      },
    },
    auditLog: {
      create() {
        return {};
      },
    },
    $transaction(callback) {
      return callback(client);
    },
  };

  return {
    client,
    getCreateData: () => createData,
    getDefinitionCount: () => definitionCount,
  };
}

test("article preset enables isolated category and tag taxonomies", async () => {
  const fixture = clientFixture();
  const service = new ContentTypesService(
    { client: fixture.client },
    authorization(),
    {},
  );

  const created = await service.create("u", "site-a", {
    kind: "COLLECTION",
    preset: "article",
    name: "Articles",
    singularName: "Article",
    pluralName: "Articles",
    slug: "articles",
  });

  assert.deepEqual(created.taxonomies, ["CATEGORY", "TAG"]);
  assert.deepEqual(fixture.getCreateData().taxonomies.create, [
    { siteId: "site-a", taxonomy: "CATEGORY" },
    { siteId: "site-a", taxonomy: "TAG" },
  ]);
  assert.equal(fixture.getDefinitionCount(), 2);
});

test("blank collection preset keeps taxonomies opt-in", async () => {
  const fixture = clientFixture();
  const service = new ContentTypesService(
    { client: fixture.client },
    authorization(),
    {},
  );

  const created = await service.create("u", "site-a", {
    kind: "COLLECTION",
    preset: "blank",
    name: "Services",
    slug: "services",
  });

  assert.deepEqual(created.taxonomies, []);
  assert.equal(fixture.getCreateData().taxonomies, undefined);
  assert.equal(fixture.getDefinitionCount(), 2);
});
