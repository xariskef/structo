import type {
  OrganizationMembershipRole,
  SiteMembershipRole,
} from "@structo/database";

export type OrganizationPermission =
  | "organization.view"
  | "organization.manage_sites"
  | "organization.manage_members";

export type SitePermission =
  | "site.view"
  | "site.manage_content"
  | "site.manage_members";

export const ORGANIZATION_ROLE_PERMISSIONS: Record<
  OrganizationMembershipRole,
  readonly OrganizationPermission[]
> = {
  OWNER: [
    "organization.view",
    "organization.manage_sites",
    "organization.manage_members",
  ],
  ADMIN: [
    "organization.view",
    "organization.manage_sites",
    "organization.manage_members",
  ],
  ANALYST: ["organization.view"],
};

export const INHERITED_SITE_PERMISSIONS: Record<
  OrganizationMembershipRole,
  readonly SitePermission[]
> = {
  OWNER: ["site.view", "site.manage_content", "site.manage_members"],
  ADMIN: ["site.view", "site.manage_content", "site.manage_members"],
  ANALYST: ["site.view"],
};

export const SITE_ROLE_PERMISSIONS: Record<
  SiteMembershipRole,
  readonly SitePermission[]
> = {
  SITE_ADMIN: ["site.view", "site.manage_content", "site.manage_members"],
  EDITOR: ["site.view", "site.manage_content"],
  AUTHOR: ["site.view", "site.manage_content"],
  VIEWER: ["site.view"],
};
