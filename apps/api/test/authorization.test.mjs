import assert from "node:assert/strict";
import { test } from "node:test";

import { NotFoundException } from "@nestjs/common";

import { AuthorizationService } from "../dist/modules/authorization/authorization.service.js";

function createService({
  organizationMemberships = {},
  siteMemberships = {},
  sites = {},
}) {
  return new AuthorizationService({
    client: {
      organizationMembership: {
        findUnique({ where }) {
          const key = `${where.organizationId_userId.organizationId}:${where.organizationId_userId.userId}`;
          return organizationMemberships[key] ?? null;
        },
      },
      site: {
        findUnique({ where }) {
          return sites[where.id] ?? null;
        },
      },
      siteMembership: {
        findUnique({ where }) {
          const key = `${where.siteId_userId.siteId}:${where.siteId_userId.userId}`;
          return siteMemberships[key] ?? null;
        },
      },
    },
  });
}

test("organization admins inherit site management only inside their organization", async () => {
  const service = createService({
    organizationMemberships: {
      "organization-a:user-a": { role: "ADMIN" },
    },
    sites: {
      "site-a": { organizationId: "organization-a" },
      "site-b": { organizationId: "organization-b" },
    },
  });

  await service.assertSitePermission("user-a", "site-a", "site.manage_members");

  await assert.rejects(
    service.assertSitePermission("user-a", "site-b", "site.view"),
    NotFoundException,
  );
});

test("site-only collaborators cannot access an unrelated site", async () => {
  const service = createService({
    siteMemberships: {
      "site-a:user-a": { role: "EDITOR" },
    },
    sites: {
      "site-a": { organizationId: "organization-a" },
      "site-b": { organizationId: "organization-b" },
    },
  });

  await service.assertSitePermission(
    "user-a",
    "site-a",
    "site.publish_content",
  );

  await assert.rejects(
    service.assertSitePermission("user-a", "site-b", "site.view"),
    NotFoundException,
  );
});

test("authors can edit drafts but cannot publish content", async () => {
  const service = createService({
    siteMemberships: {
      "site-a:user-a": { role: "AUTHOR" },
    },
    sites: {
      "site-a": { organizationId: "organization-a" },
    },
  });

  await service.assertSitePermission("user-a", "site-a", "site.edit_content");

  await assert.rejects(
    service.assertSitePermission("user-a", "site-a", "site.publish_content"),
    NotFoundException,
  );
});

test("organization analysts cannot create sites", async () => {
  const service = createService({
    organizationMemberships: {
      "organization-a:user-a": { role: "ANALYST" },
    },
  });

  await assert.rejects(
    service.assertOrganizationPermission(
      "user-a",
      "organization-a",
      "organization.manage_sites",
    ),
    NotFoundException,
  );
});

test("organization analysts can view organization audit logs", async () => {
  const service = createService({
    organizationMemberships: {
      "organization-a:analyst": { role: "ANALYST" },
    },
  });

  const role = await service.assertOrganizationPermission(
    "analyst",
    "organization-a",
    "organization.view_audit_logs",
  );

  assert.equal(role, "ANALYST");
});

test("site admins and inherited org roles can view audit logs; editors cannot", async () => {
  const service = createService({
    organizationMemberships: {
      "organization-a:analyst": { role: "ANALYST" },
    },
    siteMemberships: {
      "site-a:admin": { role: "SITE_ADMIN" },
      "site-a:editor": { role: "EDITOR" },
    },
    sites: {
      "site-a": { organizationId: "organization-a" },
    },
  });

  await service.assertSitePermission("admin", "site-a", "site.view_audit_logs");
  await service.assertSitePermission(
    "analyst",
    "site-a",
    "site.view_audit_logs",
  );

  await assert.rejects(
    service.assertSitePermission("editor", "site-a", "site.view_audit_logs"),
    NotFoundException,
  );
});
