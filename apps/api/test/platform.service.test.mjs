import assert from "node:assert/strict";
import test from "node:test";

import { PlatformService } from "../dist/modules/platform/platform.service.js";

function createClient({
  counts = {},
  rows = [],
  users = [],
  queryRawThrows = false,
} = {}) {
  const calls = {};
  const client = {
    $transaction: (operations) => Promise.all(operations),
    $queryRaw: () =>
      queryRawThrows
        ? Promise.reject(new Error("connection refused"))
        : Promise.resolve([{ ok: 1 }]),
    organization: { count: () => counts.organizations ?? 0 },
    site: { count: () => counts.sites ?? 0 },
    user: {
      count: () => counts.users ?? 0,
      findMany(args) {
        calls.userFindMany = args;
        return users;
      },
    },
    auditLog: {
      findMany(args) {
        calls.auditFindMany = args;
        return rows;
      },
      count: () => rows.length,
    },
  };
  return { client, calls };
}

test("platform overview returns counts and recent activity", async () => {
  const { client } = createClient({
    counts: { organizations: 3, sites: 7, users: 12 },
    rows: [
      {
        id: "l1",
        organizationId: "org-a",
        siteId: "site-a",
        actorId: "u1",
        action: "media.upload",
        entityType: "MediaAsset",
        entityId: "m1",
        metadata: { filename: "a.png" },
        createdAt: new Date("2026-06-02T08:00:00.000Z"),
      },
    ],
    users: [{ id: "u1", name: "Op", email: "op@example.com" }],
  });
  const service = new PlatformService({ client });

  const overview = await service.getOverview();

  assert.deepEqual(overview.counts, {
    organizations: 3,
    sites: 7,
    users: 12,
  });
  assert.equal(overview.recentAuditLogs.length, 1);
  assert.equal(overview.recentAuditLogs[0].actorName, "Op");
});

test("platform health reports degraded when the database is unreachable", async () => {
  const { client } = createClient({ queryRawThrows: true });
  const service = new PlatformService({ client });

  const health = await service.getHealth();

  assert.equal(health.database, "down");
  assert.equal(health.status, "degraded");
  assert.deepEqual(health.counts, { organizations: 0, sites: 0, users: 0 });
});

test("platform health reports ok with counts when the database is reachable", async () => {
  const { client } = createClient({
    counts: { organizations: 1, sites: 2, users: 4 },
  });
  const service = new PlatformService({ client });

  const health = await service.getHealth();

  assert.equal(health.database, "up");
  assert.equal(health.status, "ok");
  assert.deepEqual(health.counts, { organizations: 1, sites: 2, users: 4 });
  assert.equal(typeof health.checkedAt, "string");
});

test("platform audit logs apply optional filters with no tenant pin", async () => {
  const { client, calls } = createClient({ rows: [] });
  const service = new PlatformService({ client });

  await service.listAuditLogs({
    page: 1,
    pageSize: 20,
    action: "entry.publish",
  });

  assert.equal(calls.auditFindMany.where.action, "entry.publish");
  assert.equal(calls.auditFindMany.where.organizationId, undefined);
  assert.equal(calls.auditFindMany.where.siteId, undefined);
});
