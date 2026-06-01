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
site.manage_content_types
site.create_content
site.edit_content
site.publish_content
site.manage_taxonomies
site.manage_members
site.manage_settings
```

Only organization owners, organization administrators and site administrators
can change content type schemas. Editors can publish. Authors can create and
edit drafts but cannot publish.

## Secrets

- Commit placeholders only in `.env.example`.
- Keep Neon connection strings in local environment files or deployment secret
  storage only.
- Never commit real API keys, database URLs or object storage credentials.
- Hash API tokens before persistence.
- Encrypt reversible provider credentials at rest.
- Show newly generated delivery tokens once.
- Rotate exposed credentials immediately.

## Dynamic Content

- Validate field schemas before activation.
- Validate present draft entry values server-side before persistence.
- Reject undeclared dynamic entry keys.
- Validate all required values again before publishing.
- Treat stored TipTap rich-text HTML as untrusted content.
- Sanitize rich-text HTML at the delivery or frontend rendering boundary before
  inserting it into a document.
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
- Generate storage keys server-side.
- Keep uploads scoped to a site.
- Store metadata in PostgreSQL.
- Add malware scanning later if deployment risk requires it.

## Logging

- Record important management operations in audit logs.
- Avoid writing secrets, raw tokens or sensitive personal data to logs.
- Include actor, tenant, action, entity and timestamp when possible.

## Reference Project Warning

The legacy reference project contains example environment files with
real-looking credentials. Treat those credentials as exposed and rotate them.
Do not copy them into Structo CMS.
