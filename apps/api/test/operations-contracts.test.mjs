import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  auditLogsQuerySchema,
  clearAuditLogsResultSchema,
  paginatedAuditLogsSchema,
  platformHealthSummarySchema,
  platformOverviewSummarySchema,
} from "@structo/contracts";

import {
  sanitizeAuditMetadata,
  toAuditLogSummary,
} from "../dist/modules/audit-logs/audit-log.serializer.js";

describe("operations contracts", () => {
  it("coerces pagination and applies defaults", () => {
    assert.deepEqual(auditLogsQuerySchema.parse({ page: "2", pageSize: "5" }), {
      page: 2,
      pageSize: 5,
    });
    assert.deepEqual(auditLogsQuerySchema.parse({}), { page: 1, pageSize: 20 });
  });

  it("rejects an out-of-range pageSize", () => {
    assert.ok(!auditLogsQuerySchema.safeParse({ pageSize: "500" }).success);
  });

  it("accepts a well-formed paginated payload", () => {
    assert.ok(
      paginatedAuditLogsSchema.safeParse({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }).success,
    );
  });

  it("validates a clear-audit-logs result", () => {
    assert.ok(
      clearAuditLogsResultSchema.safeParse({ deletedCount: 5 }).success,
    );
    assert.ok(
      !clearAuditLogsResultSchema.safeParse({ deletedCount: -1 }).success,
    );
  });

  it("requires a known platform health status", () => {
    const base = {
      database: "up",
      checkedAt: "2026-06-02T00:00:00.000Z",
      counts: { organizations: 0, sites: 0, users: 0 },
    };
    assert.ok(
      platformHealthSummarySchema.safeParse({ status: "ok", ...base }).success,
    );
    assert.ok(
      !platformHealthSummarySchema.safeParse({ status: "weird", ...base })
        .success,
    );
  });

  it("validates a platform overview payload", () => {
    assert.ok(
      platformOverviewSummarySchema.safeParse({
        counts: { organizations: 1, sites: 1, users: 1 },
        recentAuditLogs: [],
      }).success,
    );
  });
});

describe("audit metadata sanitization", () => {
  it("redacts secret-looking keys recursively", () => {
    const result = sanitizeAuditMetadata({
      name: "ok",
      tokenHash: "secret-value",
      nested: { password: "x", title: "keep" },
      list: [{ apiKey: "k" }, { plain: "y" }],
    });

    assert.equal(result.name, "ok");
    assert.equal(result.tokenHash, "[redacted]");
    assert.equal(result.nested.password, "[redacted]");
    assert.equal(result.nested.title, "keep");
    assert.equal(result.list[0].apiKey, "[redacted]");
    assert.equal(result.list[1].plain, "y");
  });

  it("maps a row to a sanitized, ISO-stamped summary", () => {
    const summary = toAuditLogSummary(
      {
        id: "l1",
        organizationId: "org-a",
        siteId: "site-a",
        actorId: "u1",
        action: "api_token.create",
        entityType: "SiteApiToken",
        entityId: "t1",
        metadata: { name: "Prod", secret: "nope" },
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
      },
      { id: "u1", name: "Op", email: "op@example.com" },
    );

    assert.equal(summary.actorName, "Op");
    assert.equal(summary.actorEmail, "op@example.com");
    assert.equal(summary.metadata.name, "Prod");
    assert.equal(summary.metadata.secret, "[redacted]");
    assert.equal(summary.createdAt, "2026-06-02T00:00:00.000Z");
  });

  it("handles scheduled events with no actor", () => {
    const summary = toAuditLogSummary(
      {
        id: "l2",
        organizationId: "org-a",
        siteId: "site-a",
        actorId: null,
        action: "entry.publish_scheduled",
        entityType: "ContentEntry",
        entityId: "e1",
        metadata: null,
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
      },
      undefined,
    );

    assert.equal(summary.actorId, null);
    assert.equal(summary.actorName, null);
    assert.equal(summary.actorEmail, null);
    assert.equal(summary.metadata, null);
  });
});
