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
/sites
/sites/:siteId
/sites/:siteId/members
/sites/:siteId/invitations
/sites/:siteId/settings
/sites/:siteId/content-types
/sites/:siteId/content-types/:contentTypeId
/sites/:siteId/content-types/:contentTypeId/activate
/sites/:siteId/content-types/:contentTypeId/archive
/sites/:siteId/entries
/sites/:siteId/entries/:entryId
/sites/:siteId/entries/:entryId/publish
/sites/:siteId/entries/:entryId/unpublish
/sites/:siteId/entries/:entryId/archive
/sites/:siteId/entries/:entryId/revisions
/sites/:siteId/api-tokens
/sites/:siteId/media
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
- Content types provide generic custom post-type collections with versioned
  field schemas.
- Entries support incomplete drafts, strict publishing, unpublishing, archival
  and revision summaries.

## Delivery API

Base path:

```text
/api/v1/delivery
```

Initial routes:

```text
/sites/:siteKey/settings
/sites/:siteKey/content-types
/sites/:siteKey/content-types/:contentTypeSlug/entries
/sites/:siteKey/content-types/:contentTypeSlug/entries/:entrySlug
```

Delivery rules:

- Return published content only.
- Resolve one site by stable public `siteKey`.
- Scope API tokens to one site.
- Do not leak internal IDs unless the contract requires them.
- Expose predictable pagination, filtering and sorting.

## Platform API

Base path:

```text
/api/v1/platform
```

This route group is restricted to platform operators.

Initial route groups are added later:

```text
/organizations
/users
/health
/audit-logs
/analytics
```

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

## Open Questions

- Should a site optionally allow public delivery without a token?
- Which pagination style should be the default?
- Which filters are included in the first delivery release?
- Should preview tokens be added immediately after publishing or later?
