# Architecture

## Status

The modular monolith scaffold, identity and tenancy, administration UI, site
settings, custom content types and content entry modules are implemented. Core
content hardening, the editorial workflow and scoped versioned taxonomies are
implemented. Navigation menus are next, before delivery endpoints are added.

## System Shape

Structo CMS is a headless CMS with a modular monolith backend.

```text
External Frontend Projects
          |
          | Delivery REST API
          v
+--------------------------+
| apps/api                 |
| NestJS modular monolith  |
+--------------------------+
          |
          v
+--------------------------+
| PostgreSQL               |
+--------------------------+

+--------------------------+
| apps/admin               |
| Next.js admin panel      |
+--------------------------+
          |
          | Management REST API
          v
+--------------------------+
| apps/api                 |
+--------------------------+
```

The backend is deployed as one application initially. Internally, each domain
has a dedicated NestJS module with explicit responsibilities.

## Administration Levels

### Platform Administration

Platform administration is reserved for operators of the Structo CMS service.
It is separate from customer organization administration.

Responsibilities:

- Organizations and users overview
- Platform health
- Support operations
- Platform-wide logs
- Aggregate system usage

### Organization Dashboard

An organization is the management boundary for a customer, team or business.
An organization can own multiple sites.

Responsibilities:

- Site creation and overview
- Organization members
- Organization invitations
- Aggregated analytics
- Organization activity logs
- Quick access to each site dashboard

### Site Dashboard

A site is the content and delivery boundary for one frontend website or
application.

Responsibilities:

- Site settings
- Site members
- Content types
- Content entries
- Publishing
- Media
- Site analytics
- Site activity logs
- Delivery API tokens

External collaborators can be granted site-only access without access to the
organization dashboard.

## Backend Modules

Implemented modules:

```text
apps/api/src/modules/
  health/
  auth/
  authorization/
  database/
  organizations/
  sites/
  invitations/
  settings/
  content-types/
  entries/
  taxonomies/
```

Planned later modules:

```text
apps/api/src/modules/
  users/
  organization-memberships/
  site-memberships/
  media/
  api-tokens/
  delivery/
  audit-logs/
  analytics/
  platform-admin/
```

Each module should contain its controller, service, DTOs and tests. Shared
contracts belong in `packages/contracts`, not in unrelated feature modules.

## Tenant Boundaries

The tenancy hierarchy is:

```text
Platform
  Organization
    Site
      Site-owned content
```

Rules:

- Organization data is always scoped by `organizationId`.
- Site data is always scoped by `siteId`.
- A site belongs to exactly one organization.
- Organization owners and administrators inherit access to organization sites.
- Site-only members receive access through explicit site membership.
- Delivery tokens are scoped to one site.
- Tenant checks must occur in API service methods, not only in the UI.

## API Surfaces

```text
/api/v1/manage/...      Authenticated administration operations
/api/v1/delivery/...    Read-only frontend content delivery
/api/v1/platform/...    Restricted platform operator operations
```

Management and delivery concerns remain separate even though they are hosted by
the same backend application.

## Storage

PostgreSQL is the initial system of record.

- Neon hosts the remote PostgreSQL database.
- Relational columns store identity, ownership, lifecycle and query-critical
  data.
- JSONB stores dynamic content entry values and versioned field schemas.
- Object storage stores media files.
- The database stores media metadata and object references.

## Deployment

Initial deployment units:

```text
Admin application
API application
Neon PostgreSQL database
S3-compatible object storage
```

The API stays a modular monolith until a measured operational need justifies
extracting a module into an independent service.

## Explicit Non-Goals For Initial Releases

- Microservices
- Page builder
- Website rendering inside the CMS
- Plugin runtime
- GraphQL
- Runtime execution of generated JavaScript
- AI-generated frontend components
