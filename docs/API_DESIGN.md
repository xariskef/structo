# API Design

## Goal

Provide a stable REST API for administration and external frontend delivery.

## Conventions

- Prefix all routes with `/api/v1`.
- Use JSON request and response bodies unless uploading files.
- Publish OpenAPI documentation from the beginning.
- Validate all incoming data.
- Return consistent error envelopes.
- Use cursor or page-based pagination consistently once finalized.

Operational bootstrap route:

```text
GET /api/v1/health
```

Interactive OpenAPI documentation is exposed at `/api/docs`.

Proposed error envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request body is invalid.",
    "details": []
  }
}
```

## Management API

Base path:

```text
/api/v1/manage
```

Initial route groups:

```text
/auth/register
/auth/register-invited
/auth/login
/auth/logout
/auth/me
/organizations
/organizations/:organizationId
/organizations/:organizationId/members
/organizations/:organizationId/sites
/organizations/:organizationId/invitations
/organizations/:organizationId/audit-logs
/sites
/sites/:siteId
/sites/:siteId/members
/sites/:siteId/invitations
/sites/:siteId/settings
/sites/:siteId/content-types
/sites/:siteId/content-types/bulk
/sites/:siteId/content-types/:contentTypeId
/sites/:siteId/content-types/:contentTypeId/activate
/sites/:siteId/content-types/:contentTypeId/archive
/sites/:siteId/content-types/:contentTypeId/single
/sites/:siteId/entries
/sites/:siteId/entries/bulk
/sites/:siteId/entries/:entryId
/sites/:siteId/entries/:entryId/duplicate
/sites/:siteId/entries/:entryId/publish
/sites/:siteId/entries/:entryId/unpublish
/sites/:siteId/entries/:entryId/archive
/sites/:siteId/entries/:entryId/schedule
/sites/:siteId/entries/:entryId/revisions
/sites/:siteId/entries/:entryId/available-taxonomy-terms
/sites/:siteId/entries/:entryId/taxonomy-terms
/sites/:siteId/taxonomy-definitions
/sites/:siteId/taxonomy-definitions/:definitionId
/sites/:siteId/taxonomy-definitions/:definitionId/terms
/sites/:siteId/taxonomy-terms/:termId
/sites/:siteId/navigation-menus
/sites/:siteId/navigation-menus/:menuId
/sites/:siteId/navigation-link-targets
/sites/:siteId/api-tokens
/sites/:siteId/media
/sites/:siteId/media/:assetId
/sites/:siteId/audit-logs
/invitations/accept
```

Management routes require an authenticated user session and authorization for
the requested organization or site.

Implemented management foundation:

- Owner registration creates the first organization and an `OWNER` membership.
- Login and registration set an opaque server-side session cookie.
- `GET /manage/organizations` lists organization memberships for the current
  user.
- `GET /manage/sites` lists both inherited and direct site access.
- Site creation requires `organization.manage_sites`.
- Invitation creation and acceptance use one-time raw tokens whose hashes are
  persisted.
- Site settings are validated and site-scoped.
- Content types provide repeatable `COLLECTION` types and standalone `SINGLE`
  pages with versioned field schemas.
- Content type creation accepts an optional `preset`: `blank` and `article`
  initialize collections, while `page` initializes a standalone page. Article
  collections begin with categories and tags enabled; all preset output remains
  editable through the normal structure endpoints.
- `POST /manage/sites/:siteId/content-types/:contentTypeId/single` resolves or
  creates the one backing item for a `SINGLE` page and rejects collections.
- Entries support incomplete drafts, strict publishing, scheduling,
  unpublishing, archival, duplicate, hard delete, bulk actions and revision
  summaries.
- Single-page backing items cannot be archived or hard-deleted through generic
  entry actions.
- Scheduled publication creates the same immutable revision and audit trail as
  an explicit publish action.
- Taxonomy definitions use a shared Pages scope or an isolated collection
  scope. Categories allow parent relationships; tags remain flat.
- Taxonomy terms expose built-in descriptions and SEO metadata plus validated
  custom data from immutable definition schema versions.
- Content types opt into supported taxonomies, and entry assignments reject
  terms from another site, another collection scope or a taxonomy not enabled
  for that content type.
- Navigation menus are named, site-scoped lists whose nested `items` tree is
  read and saved whole. `navigation-link-targets` aggregates pickable pages,
  collection archives and published collection items so the editor builds links
  in one round-trip. Mutations require `site.manage_navigation`; the first list
  of a site seeds a default `main` menu.
- API tokens are site-scoped, stored as hashes and revealed once when issued.
  Token management requires `site.manage_api_tokens`.
- Media list, multipart upload, metadata update and deletion routes remain
  site-scoped. Uploads create object keys server-side, validate file signatures
  and store metadata before assets can be selected by dynamic fields.
- Audit-log listings are read-only, newest-first and offset-paginated with
  optional `action`, `entityType` and (organization scope) `siteId` filters.
  Organization listings require `organization.view_audit_logs`; site listings
  require `site.view_audit_logs`. The route scope is authoritative — a
  client-provided `siteId` on a site listing is ignored, and an
  organization-scoped `siteId` filter only narrows within the organization.
  Actor display data is resolved in one batched query and log metadata is
  sanitized before it is returned. `GET /manage/auth/me` additionally reports
  whether the current user is a platform operator.
- An activity log can be cleared with `DELETE` on the same path
  (`/manage/organizations/:organizationId/audit-logs`,
  `/manage/sites/:siteId/audit-logs`). Clearing requires the manage permissions
  (`organization.manage_audit_logs` / `site.manage_audit_logs`, held by owners,
  admins and site administrators) and is destructive, but it is itself recorded
  as a new `audit_log.clear` event with the actor, scope and deleted count.

## Delivery API

Base path:

```text
/api/v1/delivery
```

Initial routes:

```text
/sites/:siteKey/settings
/sites/:siteKey/content-types
/sites/:siteKey/content-types/:contentTypeSlug
/sites/:siteKey/content-types/:contentTypeSlug/entries
/sites/:siteKey/content-types/:contentTypeSlug/entries/:entrySlug
/sites/:siteKey/navigation-menus
/sites/:siteKey/navigation-menus/:menuKey
```

Delivery rules:

- Return published content only.
- Resolve one site by stable public `siteKey`.
- Require a scoped `content:read` Bearer token on every delivery request.
- Do not leak internal IDs unless the contract requires them.
- Use offset pagination with `page`, `pageSize` and a response `meta` block.
- Sort by published date or title and filter entries by category or tag slug.
- Serve OpenAPI 3.1 JSON at `/api/v1/delivery/openapi.json` and Swagger UI at
  `/api/v1/delivery/docs`.
- Sanitize declared TipTap rich-text values recursively before returning entry
  data.

## Platform API

Base path:

```text
/api/v1/platform
```

This route group is restricted to platform operators. Access derives only from
an explicit `PlatformOperatorAccess` grant, enforced by a dedicated guard that
runs after the global session guard. Organization ownership and site roles never
satisfy it. Non-operators are rejected consistently.

Implemented routes:

```text
GET /platform/overview      Organization/site/user counts + recent activity
GET /platform/health        Database reachability, checkedAt, high-level counts
GET /platform/audit-logs    Platform-wide, newest-first, same safe pagination
```

Platform rules:

- All platform routes are read-only.
- `health` reports a high-level summary only. It never exposes connection
  strings, environment values, stack traces or raw database errors, and degrades
  to `status: "degraded"`, `database: "down"` when the database is unreachable.
- `audit-logs` uses the same query contract and metadata sanitization as the
  management audit-log routes but is not pinned to a tenant.
- The public `GET /api/v1/health` route stays minimal for load-balancer and
  readiness checks; expensive aggregate counts live only on the operator routes.

Deferred (pending Q-004): `/platform/analytics` and any user-management or
support mutations. This phase adds no impersonation or destructive actions.

## Authentication And Authorization

Management API:

```text
User session
  -> resolve identity
  -> resolve organization or site context
  -> check membership or inherited access
  -> run service method with tenant scope
```

Delivery API:

```text
Read-only site token
  -> hash and resolve token
  -> verify scope and site
  -> return published site content
```

Platform API:

```text
User session
  -> resolve identity (global session guard)
  -> require explicit PlatformOperatorAccess (platform guard)
  -> run read-only operator service
```

## Deferred Delivery Questions

- Should a site optionally allow public delivery without a token?
- Should scoped preview tokens be added after publishing?
