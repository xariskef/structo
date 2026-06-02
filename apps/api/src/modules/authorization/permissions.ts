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
  | "site.manage_content_types"
  | "site.create_content"
  | "site.edit_content"
  | "site.publish_content"
  | "site.manage_taxonomies"
  | "site.manage_navigation"
  | "site.manage_media"
  | "site.manage_api_tokens"
  | "site.manage_members"
  | "site.manage_settings";

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
  OWNER: [
    "site.view",
    "site.manage_content_types",
    "site.create_content",
    "site.edit_content",
    "site.publish_content",
    "site.manage_taxonomies",
    "site.manage_navigation",
    "site.manage_media",
    "site.manage_api_tokens",
    "site.manage_members",
    "site.manage_settings",
  ],
  ADMIN: [
    "site.view",
    "site.manage_content_types",
    "site.create_content",
    "site.edit_content",
    "site.publish_content",
    "site.manage_taxonomies",
    "site.manage_navigation",
    "site.manage_media",
    "site.manage_api_tokens",
    "site.manage_members",
    "site.manage_settings",
  ],
  ANALYST: ["site.view"],
};

export const SITE_ROLE_PERMISSIONS: Record<
  SiteMembershipRole,
  readonly SitePermission[]
> = {
  SITE_ADMIN: [
    "site.view",
    "site.manage_content_types",
    "site.create_content",
    "site.edit_content",
    "site.publish_content",
    "site.manage_taxonomies",
    "site.manage_navigation",
    "site.manage_media",
    "site.manage_api_tokens",
    "site.manage_members",
    "site.manage_settings",
  ],
  EDITOR: [
    "site.view",
    "site.create_content",
    "site.edit_content",
    "site.publish_content",
    "site.manage_taxonomies",
    "site.manage_navigation",
    "site.manage_media",
  ],
  AUTHOR: [
    "site.view",
    "site.create_content",
    "site.edit_content",
    "site.manage_media",
  ],
  VIEWER: ["site.view"],
};
