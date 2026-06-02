# Security Baseline

## Goal

Protect tenant data, credentials and publishing boundaries from the first
implementation milestone.

## Tenant Isolation

- Treat organization and site identifiers from the client as untrusted input.
- Scope database queries by tenant ownership.
- Verify organization or site access in backend service methods.
- Add integration tests that attempt cross-organization and cross-site access.
- Keep platform operator access separate from organization roles.

## Authentication

- Use secure session cookies for the administration application.
- Store password hashes through a maintained authentication library.
- Support invitation expiry and one-time acceptance.
- Rate limit authentication endpoints.
- Do not expose whether an email exists unless required by the flow.

Implemented authentication baseline:

- Hash passwords with `argon2` using Argon2id, `19 MiB` memory, `2` iterations
  and parallelism `1`.
- Generate opaque session tokens with Node.js `crypto.randomBytes`.
- Persist only SHA-256 session token hashes.
- Set administration sessions in `HttpOnly`, `SameSite=Strict` cookies.
- Enable the cookie `Secure` flag in production.
- Expire administration sessions after eight hours.
- Persist only SHA-256 invitation token hashes.
- Expire invitations after seven days and accept each invitation once.
- Apply a global management rate limit and a stricter five-request-per-minute
  limit to registration and login endpoints.
- Allow the Playwright-managed API process to raise the authentication limit
  only when `NODE_ENV=test`, so browser suites remain deterministic without
  weakening production defaults.

References:

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## Authorization

Initial access model:

```text
Platform operator
  Platform-level support and monitoring access.

Organization OWNER
  Full organization and inherited site access.

Organization ADMIN
  Organization management and inherited site access.

Organization ANALYST
  Aggregated organization analytics and logs.

Site SITE_ADMIN
  Full access to one site.

Site EDITOR
  Edit and publish site content.

Site AUTHOR
  Draft and edit permitted site content.

Site VIEWER
  Read-only site administration access.
```

Exact permissions must be represented explicitly in code rather than scattered
role string comparisons.

Implemented site permissions:

```text
site.view
site.view_audit_logs
site.manage_content_types
site.create_content
site.edit_content
site.publish_content
site.manage_taxonomies
site.manage_navigation
site.manage_media
site.manage_api_tokens
site.manage_members
site.manage_settings
```

Implemented organization permissions:

```text
organization.view
organization.view_audit_logs
organization.manage_sites
organization.manage_members
```

Only organization owners, organization administrators and site administrators
can change content type schemas. Editors can publish. Authors can create and
edit drafts but cannot publish. Audit-log viewing is read-only and separate:
`organization.view_audit_logs` is held by org OWNER, ADMIN and ANALYST;
`site.view_audit_logs` is held by SITE_ADMIN and inherited by those same org
roles. Editors, authors and viewers cannot read activity logs.

## Platform Operator Access

- Platform operator access is a standalone grant (`PlatformOperatorAccess`,
  role `PLATFORM_ADMIN`), fully separate from organization and site membership.
- Organization ownership, organization roles and site roles never imply
  platform access.
- Enforce platform access with a dedicated guard on `/api/v1/platform` routes,
  running after the global session guard. Reject non-operators consistently.
- Keep all platform routes read-only in this phase. Do not add a public
  self-service route to become a platform operator, organization impersonation
  or destructive support actions.
- Grant the role out of band with the documented development helper
  (`pnpm --filter @structo/database db:grant-operator <email>`), never during
  ordinary registration.
- Platform health must stay high level: never return connection strings,
  environment values, stack traces or raw database errors.

## Secrets

- Commit placeholders only in `.env.example`.
- Keep Neon connection strings in local environment files or deployment secret
  storage only.
- Never commit real API keys, database URLs or object storage credentials.
- Hash API tokens before persistence.
- Prefix raw delivery tokens with `stk_`, scope them to one site and require the
  `content:read` scope for delivery requests.
- Reject delivery from archived sites and reject revoked or expired tokens.
- Encrypt reversible provider credentials at rest.
- Show newly generated delivery tokens once.
- Grant token issuance and revocation only to organization owners,
  organization administrators and site administrators.
- Rotate exposed credentials immediately.

## Dynamic Content

- Validate field schemas before activation.
- Validate present draft entry values server-side before persistence.
- Reject undeclared dynamic entry keys.
- Validate all required values again before publishing.
- Treat stored TipTap rich-text HTML as untrusted content.
- Sanitize declared rich-text HTML server-side at the Delivery API boundary,
  including values nested in groups and repeaters.
- Use an explicit allowlist for TipTap formatting tags and safe link schemes;
  strip executable tags, unsafe attributes and unsafe links before delivery.
- Do not execute dynamic JavaScript stored in the database.
- Do not use `eval()` or `new Function()`.
- Scope taxonomy definitions, terms and entry assignments to the requested
  site.
- Reject cross-site taxonomy parents, ancestry cycles and assignments for
  taxonomies not enabled by the entry's content type.
- Reject taxonomy assignments from another collection scope even when both
  collections belong to the same site.
- Validate dynamic taxonomy term values against the latest definition schema
  and prune removed keys only during controlled schema migration.

## Media

- Restrict MIME types and file sizes.
- Verify upload signatures instead of trusting browser-declared MIME types.
- Generate storage keys server-side.
- Keep uploads scoped to a site.
- Store metadata in PostgreSQL.
- Validate dynamic media references against the current site before saving
  entries or taxonomy term custom fields.
- Refuse media deletion while an entry or taxonomy term still references the
  asset.
- Keep R2 access keys in secret storage and expose only the intended public
  media base URL.
- Add malware scanning later if deployment risk requires it.

## Per-Site Storage Credentials

- Storage credentials (R2 access key ID, secret access key, bucket, public URL)
  are persisted as `SiteSetting` rows (no new table or migration).
- The secret access key is encrypted at rest with AES-256-GCM using the
  platform-level `STORAGE_ENCRYPTION_KEY` env var. Format: `v1:<iv>:<tag>:<data>`
  (all base64 components).
- The secret is **write-only**: the API never returns it. The `getStatus`
  response includes only a `secretSet` boolean.
- Saving credentials triggers a real test write to the bucket; invalid
  credentials are rejected with `400 Bad Request` before anything is persisted.
- Access is gated by the existing `site.manage_settings` permission.
- Both `update` and `clear` are recorded as `site.storage.update` /
  `site.storage.clear` audit events.
- When `STORAGE_ENCRYPTION_KEY` is absent or decryption fails, the platform-level
  R2 env fallback is used silently (a warning is logged).

## Logging

- Record important management operations in audit logs.
- Avoid writing secrets, raw tokens or sensitive personal data to logs.
- Include actor, tenant, action, entity and timestamp when possible.
- Expose audit logs read-only through explicit `*.view_audit_logs` permissions.
  Re-enforce organization and site scope in the service layer; a foreign
  `siteId` filter must match nothing rather than reveal another tenant's events.
- Sanitize audit metadata at the read boundary, redacting secret-looking keys
  (password, token, hash, secret, credential, authorization, cookie, api key,
  private key) before activity is returned, as defence in depth.
- Resolve actor display data in one batched query (no N+1) and render events
  with no actor (scheduled jobs) as a system actor.
- Clearing an activity log is a separate, destructive manage action
  (`organization.manage_audit_logs` / `site.manage_audit_logs`, held only by
  owners, admins and site administrators — never analysts, editors, authors or
  viewers). It requires confirmation in the UI and is itself recorded as a new
  `audit_log.clear` event (actor, scope, deleted count), so the trail always
  shows who cleared it and when. This is a deliberate trade-off: it reduces the
  log's tamper-evidence in exchange for an administrator-controlled reset.

## Reference Project Warning

The legacy reference project contains example environment files with
real-looking credentials. Treat those credentials as exposed and rotate them.
Do not copy them into Structo CMS.
