# Architecture Decisions

This document records accepted decisions, proposed defaults and unresolved
questions. Update it whenever an architectural choice changes.

## Accepted Decisions

### D-001: Build A New Project

Status: accepted.

Structo CMS is a clean implementation rather than an evolution of an earlier
prototype.

### D-002: Headless CMS

Status: accepted.

The CMS manages content and exposes it through an API. Public frontend projects
are deployed separately.

### D-003: Multi-Site Organizations

Status: accepted.

Users can manage multiple sites through an organization dashboard. External
collaborators can receive direct site-only access.

### D-004: Three Administration Levels

Status: accepted.

The system separates:

```text
Platform administration
Organization dashboard
Site dashboard
```

### D-005: Modular Monolith Backend

Status: accepted.

The backend starts as one deployable API application with clear internal
modules. Microservices are not an initial goal.

### D-006: Separate Frontend Delivery API

Status: accepted.

Management operations and frontend delivery operations use separate route
groups and permissions.

### D-007: Structured Content Before Presentation Tools

Status: accepted.

The first releases prioritize content types, dynamic fields, groups and
repeaters. A page builder is outside the initial scope.

### D-008: No Runtime Generated Code Execution

Status: accepted.

Do not execute database-stored JavaScript or AI-generated frontend code.

### D-009: Remote Neon PostgreSQL

Status: accepted.

Use a remote Neon PostgreSQL database. Do not add a local PostgreSQL Docker
service to the initial scaffold.

Use separate connection strings:

```text
DATABASE_URL   Pooled runtime connection
DIRECT_URL     Direct migration connection
```

## Proposed Defaults

These choices are recommended but can change before implementation.

### D-101: Repository Shape

Status: accepted.

Use a `pnpm` workspace with Turborepo.

### D-102: API Framework

Status: accepted.

Use NestJS with its default Express adapter initially.

### D-103: Administration Application

Status: accepted.

Use Next.js and React for the administration application.

### D-104: Database

Status: accepted.

Use PostgreSQL with Prisma ORM and versioned migrations.

### D-105: Validation

Status: accepted.

Use Zod for static DTO contracts and generated Zod schemas for dynamic content
validation. Keep the dynamic schema generation inside `packages/field-kit` so
management and future delivery behavior share one implementation.

JSON Schema export can be added later if external schema interoperability
becomes necessary. Ajv is not required for the current runtime path.

### D-106: Rich Text

Status: accepted.

Use a TipTap editor for `richText` fields, storing the result as **HTML** in the
entry's JSON data. HTML is directly consumable by any frontend through the
future delivery API and matches the reference project. TipTap JSON storage is
deferred and can be added later if structured querying or server-side
transformation of rich text becomes necessary.

### D-107: Media Storage

Status: proposed.

Use an S3-compatible storage abstraction with a Cloudflare R2 provider.

### D-108: Stable Dependency Policy

Status: accepted.

Use the latest stable compatible dependency releases available at
implementation time. Verify versions from live official sources instead of
relying on remembered versions. Exclude prerelease channels unless a documented
decision explicitly opts into one.

For Node.js, prefer the latest supported active LTS release for production.

### D-109: Administration Authentication

Status: accepted.

Use Argon2id password hashes and opaque random server-side sessions for the
administration application. Store only session token hashes in PostgreSQL and
send the raw token through an `HttpOnly`, `SameSite=Strict` cookie with the
`Secure` flag enabled in production.

Store invitation token hashes rather than raw tokens. Invitation tokens are
one-time credentials with explicit expiry.

### D-110: Shared UI Component Library

Status: accepted.

Use shadcn/ui components distributed through a shared `packages/ui` workspace
package (`@structo/ui`). Components are consumed as source `.tsx` files
(not compiled) so the consuming application controls tree-shaking and styling.

Tailwind CSS v4 processes the shared globals stylesheet from within
`apps/admin` to avoid cross-package CSS module resolution issues in the pnpm
strict monorepo.

### D-111: Brand Color System

Status: accepted.

Apply the following brand palette across the full Tailwind CSS custom-property
theme:

| Role                                   | Value     |
| -------------------------------------- | --------- |
| Navy (foreground, sidebar bg)          | `#06163D` |
| Blue (primary action)                  | `#245BFF` |
| Light blue (secondary, sidebar accent) | `#5B7CFF` |
| White                                  | `#FFFFFF` |

The sidebar is always dark navy regardless of light or dark mode. The primary
action color in dark mode shifts to `#5B7CFF` for readability.

### D-112: Administration UI Layout

Status: accepted.

Use nested Next.js App Router layouts to provide context-aware sidebars:

- Organization context: dark navy sidebar with org switcher and org-level
  navigation (Overview, Members).
- Site context: dark navy sidebar with a back-link to the parent organization,
  site name and status badge, and full CMS navigation sections (Content Types,
  Entries, Media — Administration: Members, Settings).

The two contexts are visually distinct through sidebar content and hierarchy
rather than a change in base color.

### D-113: Site-Scoped Custom Post Types

Status: accepted.

Keep the flexible custom post-type concept from the reference project. A site
administrator creates a generic content type such as posts, articles, services,
products or events. Entries created under that type share its versioned dynamic
field schema.

Do not add a separate database table for each editorial collection. Pages,
articles and services are modeled through `ContentType` and `ContentEntry`
unless a future requirement proves that a distinct entity is necessary.

### D-114: Editorial Structure Before Delivery API

Status: accepted.

Add categories, tags and navigation menus before the first delivery API. These
entities shape the frontend delivery contract and should not be retrofitted
after external frontends begin consuming content.

### D-115: Collections And Pages

Status: accepted.

Content types carry a `kind`:

- `COLLECTION` holds many items (articles, products, services). It maps to the
  WordPress "custom post type" idea.
- `SINGLE` is one standalone page (home, about, contact) backed by exactly one
  item.

Both kinds share the same `ContentType` + `ContentTypeVersion` + `ContentEntry`
storage and the same dynamic field system. The distinction is enforced in the
service layer (a single page rejects a second item) and surfaced in the
administration UI as two areas: Collections and Pages. First creation is
serialized, and a single page is archived at content-type level rather than by
archiving its backing item independently.

Content types also carry `singularName` and `pluralName` so the UI can use
natural labels ("New Article") instead of the technical word "entry".

## Open Decisions

### Q-002: Delivery Visibility

Decide whether published content requires a read-only site token in all cases or
whether sites can opt into public delivery.

### Q-004: Analytics

Define the initial analytics scope:

- Administrative activity only
- CMS usage metrics
- Visitor analytics ingestion
- A staged combination of the above

### Q-005: Product Naming

Confirm the final product name, npm package scope and environment variable
prefix. The internal workspace package scope is provisionally `@structo`.
