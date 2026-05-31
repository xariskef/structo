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

  await service.assertSitePermission("user-a", "site-a", "site.manage_content");

  await assert.rejects(
    service.assertSitePermission("user-a", "site-b", "site.view"),
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
