import assert from "node:assert/strict";
import { describe, it, test } from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";

import {
  createNavigationMenuSchema,
  navigationItemsSchema,
} from "@structo/contracts";
import { NavigationService } from "../dist/modules/navigation/navigation.service.js";

function authorization() {
  return { assertSitePermission() {} };
}

function leaf(id, label = "Item") {
  return {
    id,
    label,
    type: "custom",
    url: "/x",
    target: "_self",
    children: [],
  };
}

describe("navigation contracts", () => {
  it("accepts a nested item tree", () => {
    const result = navigationItemsSchema.safeParse([
      { ...leaf("a", "Parent"), children: [leaf("b", "Child")] },
    ]);
    assert.ok(result.success, JSON.stringify(result.error));
  });

  it("rejects an invalid target", () => {
    const result = navigationItemsSchema.safeParse([
      { ...leaf("a"), target: "popup" },
    ]);
    assert.ok(!result.success);
  });

  it("rejects nesting deeper than 5 levels", () => {
    let node = leaf("deep-6");
    for (let depth = 5; depth >= 1; depth -= 1) {
      node = { ...leaf(`d-${depth}`), children: [node] };
    }
    const result = navigationItemsSchema.safeParse([node]);
    assert.ok(!result.success);
  });

  it("validates the menu key format", () => {
    assert.ok(
      createNavigationMenuSchema.safeParse({ name: "Footer", key: "footer" })
        .success,
    );
    assert.ok(
      !createNavigationMenuSchema.safeParse({ name: "Footer", key: "Footer!" })
        .success,
    );
  });
});

test("create rejects a duplicate menu key", async () => {
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    $transaction(callback) {
      return callback({
        navigationMenu: {
          create() {
            throw new Error("Unique constraint failed on the fields: (key)");
          },
        },
        auditLog: { create() {} },
      });
    },
  };
  const service = new NavigationService({ client }, authorization());
  await assert.rejects(
    service.create("u", "site-a", { name: "Main", key: "main" }),
    (error) => error instanceof ConflictException,
  );
});

test("update rejects a menu from another site", async () => {
  const client = {
    navigationMenu: {
      findUnique() {
        return { id: "m1", siteId: "other-site" };
      },
    },
  };
  const service = new NavigationService({ client }, authorization());
  await assert.rejects(
    service.update("u", "site-a", "m1", { name: "x" }),
    (error) => error instanceof NotFoundException,
  );
});

test("linkTargets groups pages, archives and items", async () => {
  const client = {
    contentType: {
      findMany() {
        return [
          {
            id: "ct-page",
            kind: "SINGLE",
            name: "About",
            pluralName: null,
            slug: "about",
          },
          {
            id: "ct-col",
            kind: "COLLECTION",
            name: "Article",
            pluralName: "Articles",
            slug: "articles",
          },
        ];
      },
    },
    contentEntry: {
      findMany() {
        return [
          {
            id: "e1",
            title: "Hello",
            slug: "hello",
            contentType: { kind: "COLLECTION", slug: "articles" },
          },
        ];
      },
    },
  };
  const service = new NavigationService({ client }, authorization());
  const targets = await service.linkTargets("u", "site-a");

  assert.deepEqual(targets.pages, [
    { id: "ct-page", label: "About", url: "/about" },
  ]);
  assert.deepEqual(targets.collectionArchives, [
    { id: "ct-col", label: "Articles", url: "/articles" },
  ]);
  assert.deepEqual(targets.collectionItems, [
    { id: "e1", label: "Hello", url: "/articles/hello" },
  ]);
});
