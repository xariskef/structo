import assert from "node:assert/strict";
import test from "node:test";

import { NotFoundException } from "@nestjs/common";

import { AuditLogsService } from "../dist/modules/audit-logs/audit-logs.service.js";

function createClient({ rows = [], total = rows.length, users = [] } = {}) {
  const calls = {};
  const client = {
    $transaction: (operations) => Promise.all(operations),
    auditLog: {
      findMany(args) {
        calls.findMany = args;
        return rows;
      },
      count(args) {
        calls.count = args;
        return total;
      },
    },
    user: {
      findMany(args) {
        calls.userFindMany = args;
        return users;
      },
    },
  };
  return { client, calls };
}

const allowAll = {
  assertOrganizationPermission() {},
  assertSitePermission() {},
};

test("organization audit logs stay pinned to the organization and batch actors", async () => {
  const { client, calls } = createClient({
    rows: [
      {
        id: "l1",
        organizationId: "org-a",
        siteId: "site-a",
        actorId: "user-a",
        action: "entry.publish",
        entityType: "ContentEntry",
        entityId: "e1",
        metadata: { title: "Hello" },
        createdAt: new Date("2026-06-02T10:00:00.000Z"),
      },
      {
        id: "l2",
        organizationId: "org-a",
        siteId: null,
        actorId: null,
        action: "settings.update",
        entityType: "SiteSetting",
        entityId: null,
        metadata: null,
        createdAt: new Date("2026-06-02T09:00:00.000Z"),
      },
    ],
    total: 2,
    users: [{ id: "user-a", name: "Ada", email: "ada@example.com" }],
  });
  const service = new AuditLogsService({ client }, allowAll);

  const result = await service.listForOrganization("user-a", "org-a", {
    page: 1,
    pageSize: 20,
    siteId: "site-a",
  });

  assert.equal(calls.findMany.where.organizationId, "org-a");
  assert.equal(calls.findMany.where.siteId, "site-a");
  // Null actors are excluded; remaining ids resolved in a single query (no N+1).
  assert.deepEqual(calls.userFindMany.where.id.in, ["user-a"]);
  assert.equal(result.data[0].actorName, "Ada");
  assert.equal(result.data[1].actorId, null);
  assert.equal(result.data[1].actorName, null);
  assert.equal(result.meta.total, 2);
  assert.equal(result.meta.totalPages, 1);
});

test("organization audit logs require organization.view_audit_logs", async () => {
  const { client } = createClient();
  const denying = {
    assertOrganizationPermission() {
      throw new NotFoundException();
    },
    assertSitePermission() {},
  };
  const service = new AuditLogsService({ client }, denying);

  await assert.rejects(
    service.listForOrganization("user-a", "org-a", { page: 1, pageSize: 20 }),
    NotFoundException,
  );
});

test("site audit logs ignore a client-provided site and apply pagination", async () => {
  const { client, calls } = createClient({ rows: [], total: 0 });
  const service = new AuditLogsService({ client }, allowAll);

  await service.listForSite("user-a", "site-a", {
    page: 3,
    pageSize: 5,
    siteId: "site-evil",
    action: "media.upload",
  });

  assert.equal(calls.findMany.where.siteId, "site-a");
  assert.equal(calls.findMany.where.action, "media.upload");
  assert.equal(calls.findMany.skip, 10);
  assert.equal(calls.findMany.take, 5);
  // No actors to resolve when there are no rows.
  assert.equal(calls.userFindMany, undefined);
});

test("site audit logs reject callers without site access", async () => {
  const { client } = createClient();
  const denying = {
    assertOrganizationPermission() {},
    assertSitePermission() {
      throw new NotFoundException();
    },
  };
  const service = new AuditLogsService({ client }, denying);

  await assert.rejects(
    service.listForSite("user-a", "site-a", { page: 1, pageSize: 20 }),
    NotFoundException,
  );
});
