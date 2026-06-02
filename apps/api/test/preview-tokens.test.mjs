import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import { PreviewTokensService } from "../dist/modules/preview-tokens/preview-tokens.service.js";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function authorization() {
  return { assertSitePermission() {} };
}

function crypto() {
  return {
    createToken() {
      return "raw";
    },
    hashToken(t) {
      return `hash:${t}`;
    },
  };
}

function makeDb(overrides = {}) {
  const previewToken = {
    findMany: async () => [],
    findUnique: async () => null,
    create: async (args) => ({
      id: "pt-1",
      siteId: args.data.siteId,
      entryId: args.data.entryId ?? null,
      tokenHash: args.data.tokenHash,
      label: args.data.label,
      expiresAt: args.data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    }),
    update: async (args) => ({ id: args.where.id, revokedAt: new Date() }),
  };

  const site = {
    findUnique: async () => ({
      organizationId: "org-1",
      key: "my-site",
    }),
  };

  const contentEntry = {
    findUnique: async () => null,
  };

  const auditLog = { create: async () => {} };

  const client = {
    previewToken: { ...previewToken, ...(overrides.previewToken ?? {}) },
    site: { ...site, ...(overrides.site ?? {}) },
    contentEntry: { ...contentEntry, ...(overrides.contentEntry ?? {}) },
    auditLog: { ...auditLog, ...(overrides.auditLog ?? {}) },
    $transaction: async (callbackOrArray) => {
      if (typeof callbackOrArray === "function") {
        return callbackOrArray(client);
      }
      // array form
      return Promise.all(callbackOrArray.map((p) => p));
    },
  };

  return { client };
}

function makeService(dbOverrides = {}) {
  return new PreviewTokensService(makeDb(dbOverrides), authorization(), crypto());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("preview-tokens: list returns empty array when no tokens", async () => {
  const svc = makeService();
  const result = await svc.list("user-1", "site-1");
  assert.deepEqual(result, []);
});

test("preview-tokens: create returns token + summary on success", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const svc = makeService();
  const result = await svc.create("user-1", "site-1", {
    label: "My preview",
    expiresAt: future,
  });
  assert.equal(result.label, "My preview");
  assert.ok(result.token.startsWith("stp_"));
  assert.ok(result.previewUrl.startsWith("/preview/"));
});

test("preview-tokens: create throws BadRequestException when expiresAt is in the past", async () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const svc = makeService();
  await assert.rejects(
    () => svc.create("user-1", "site-1", { label: "x", expiresAt: past }),
    BadRequestException,
  );
});

test("preview-tokens: create with entryId checks entry belongs to site", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  // entry belongs to a different site
  const svc = makeService({
    contentEntry: {
      findUnique: async () => ({ siteId: "other-site" }),
    },
  });
  await assert.rejects(
    () =>
      svc.create("user-1", "site-1", {
        label: "Scoped",
        expiresAt: future,
        entryId: "entry-99",
      }),
    NotFoundException,
  );
});

test("preview-tokens: create with valid entryId scopes previewUrl to that entry", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const svc = makeService({
    contentEntry: {
      findUnique: async () => ({ siteId: "site-1" }),
    },
  });
  const result = await svc.create("user-1", "site-1", {
    label: "Scoped",
    expiresAt: future,
    entryId: "entry-42",
  });
  assert.ok(result.previewUrl.includes("entry-42"));
});

test("preview-tokens: revoke throws NotFoundException when token not found", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.revoke("user-1", "site-1", "missing-id"),
    NotFoundException,
  );
});

test("preview-tokens: revoke throws NotFoundException when token belongs to another site", async () => {
  const svc = makeService({
    previewToken: {
      findUnique: async () => ({
        id: "pt-1",
        siteId: "other-site",
        label: "x",
        revokedAt: null,
      }),
    },
  });
  await assert.rejects(
    () => svc.revoke("user-1", "site-1", "pt-1"),
    NotFoundException,
  );
});

test("preview-tokens: revoke is idempotent for already-revoked token", async () => {
  const svc = makeService({
    previewToken: {
      findUnique: async () => ({
        id: "pt-1",
        siteId: "site-1",
        label: "x",
        revokedAt: new Date(),
      }),
    },
  });
  // Should not throw
  await svc.revoke("user-1", "site-1", "pt-1");
});

test("preview-tokens: resolve rejects non-stp_ prefixed tokens", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.resolve("stk_wrong_prefix"),
    NotFoundException,
  );
});

test("preview-tokens: resolve rejects unknown tokenHash", async () => {
  const svc = makeService({
    previewToken: { findUnique: async () => null },
  });
  await assert.rejects(() => svc.resolve("stp_unknown"), NotFoundException);
});

test("preview-tokens: resolve rejects expired token", async () => {
  const svc = makeService({
    previewToken: {
      findUnique: async () => ({
        siteId: "site-1",
        entryId: null,
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      }),
    },
  });
  await assert.rejects(() => svc.resolve("stp_expired"), NotFoundException);
});

test("preview-tokens: resolve rejects revoked token", async () => {
  const svc = makeService({
    previewToken: {
      findUnique: async () => ({
        siteId: "site-1",
        entryId: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(),
      }),
    },
  });
  await assert.rejects(() => svc.resolve("stp_revoked"), NotFoundException);
});

test("preview-tokens: resolve returns siteId and entryId for valid token", async () => {
  const svc = makeService({
    previewToken: {
      findUnique: async () => ({
        siteId: "site-1",
        entryId: "entry-42",
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
      }),
    },
  });
  const result = await svc.resolve("stp_valid");
  assert.equal(result.siteId, "site-1");
  assert.equal(result.entryId, "entry-42");
});
