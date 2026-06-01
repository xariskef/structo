# Structo CMS

Structo CMS is a multi-site headless content management system.

The first release focuses on a small, correct core:

- One account can manage one or more organizations.
- An organization can own multiple independent sites.
- Organization owners can manage all sites from one dashboard.
- External collaborators can be granted access to a single site only.
- Each site can define its own content types and structured fields.
- Frontend applications consume published content through a delivery API.

The public frontend is intentionally outside this repository for now. A starter
theme and SDK can be added later as separate packages.

## Project Status

Status: Phase 5.2 collections and pages completed. Phase 5.5 editorial
structure is next.

The repository now includes owner registration, login, server-side sessions,
organizations, sites, invitations, site settings, repeatable collections,
standalone pages, versioned dynamic field schemas, content entries, publishing
and functional organization and site dashboards. Stable dependencies were
verified from live official sources and the pnpm lockfile is present.

## Core Product Areas

```text
Platform Administration
  Manage organizations, users, platform health, logs and support operations.

Organization Dashboard
  Manage sites, organization members, aggregated analytics and activity logs.

Site Dashboard
  Manage site settings, content types, entries, media and site-level access.

Delivery API
  Expose published site content to external frontend applications.
```

## Repository Structure

```text
apps/
  api/            NestJS modular monolith
  admin/          Next.js administration application

packages/
  database/       Prisma schema, migrations and database client
  contracts/      Shared API DTOs and validation contracts
  field-kit/      Dynamic field registry, schemas and validation
  storage/        Storage interface and providers
  ui/             Shared administration UI components
  sdk/            Frontend delivery API client, added later
```

## Local Setup

Install dependencies with the pinned pnpm version:

```bash
corepack pnpm install
```

Before the first database migration:

1. Rotate any Neon credential that has been exposed outside secret storage.
2. Copy `.env.example` to a root `.env`.
3. Add the pooled Neon connection as `DATABASE_URL`.
4. Add the direct Neon connection as `DIRECT_URL`.
5. Generate the Prisma client with `corepack pnpm db:generate`.
6. Apply versioned migrations with `corepack pnpm db:deploy`.

Do not commit the root `.env`.

## Documentation

Start with:

- [Product Requirements](./docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Content Modeling](./docs/CONTENT_MODELING.md)
- [API Design](./docs/API_DESIGN.md)
- [Security](./docs/SECURITY.md)
- [Database](./docs/DATABASE.md)
- [Dependency Policy](./docs/DEPENDENCY_POLICY.md)
- [Decisions](./docs/DECISIONS.md)
