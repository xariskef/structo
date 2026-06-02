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

Status: Phase 8.1 operational visibility is implemented. Organizations and
sites have read-only activity logs, and Structo platform operators have a
separate restricted console with system-wide counts, recent activity and a
high-level health summary. Earlier phases — through the Phase 7 media library
and the token-authenticated delivery API — remain in place. Analytics event
ingestion is intentionally not started yet.

The repository now includes owner registration, login, server-side sessions,
organizations, sites, invitations, site settings, repeatable collections,
standalone pages, versioned dynamic field schemas, content entries, publishing
and functional organization and site dashboards. The site editor includes a
TipTap HTML editor, SEO metadata, excerpts, scheduled publishing and bulk
editorial actions. Categories and tags have built-in description and SEO fields,
support extra structured fields, use a shared Pages scope and isolated
per-collection scopes, and can be assigned from the entry editor. Stable
dependencies were verified from live official sources and the pnpm lockfile is
present. Sites can start from editable page, article or blank collection
presets, and can define several nested navigation menus with links to pages,
collection archives, collection items and custom URLs. Media and gallery fields
select assets from the site library and delivery responses expose public media
objects.

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
7. Configure the `R2_*` variables when media uploads are needed.

Do not commit the root `.env`.

## Documentation

Start with:

- [Product Requirements](./docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Content Modeling](./docs/CONTENT_MODELING.md)
- [API Design](./docs/API_DESIGN.md)
- [Delivery API](./docs/DELIVERY_API.md)
- [Security](./docs/SECURITY.md)
- [Database](./docs/DATABASE.md)
- [Dependency Policy](./docs/DEPENDENCY_POLICY.md)
- [Decisions](./docs/DECISIONS.md)
