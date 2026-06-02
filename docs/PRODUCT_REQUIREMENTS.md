# Product Requirements

## Status

This document captures the agreed initial product behavior. Update it when the
product scope changes.

## Product Summary

Structo CMS is a multi-site headless CMS. It centralizes administration for
multiple independent sites while allowing external frontend projects to consume
structured published content through an API.

## User Types

### Platform Operator

The platform operator manages the Structo CMS service itself.

Needs:

- View organizations and users.
- Monitor platform health and usage.
- Inspect platform logs.
- Perform support operations.
- Keep platform access separate from customer dashboards.

### Organization Owner

An organization owner manages one or more sites from one organization
dashboard.

Needs:

- Register an account and receive an initial organization automatically.
- Create additional sites.
- View all organization sites.
- Enter any owned site dashboard directly.
- View aggregated analytics and activity logs.
- Invite organization members.
- Invite collaborators to a specific site only.

### Site-Only Collaborator

A site-only collaborator works inside one assigned site without access to the
organization dashboard.

Needs:

- Log in and enter the assigned site dashboard directly.
- Access only permitted site features.
- Never see unrelated sites or organization-wide information.

### Frontend Developer

A frontend developer consumes published site content from an external project.

Needs:

- Use a stable delivery API.
- Retrieve site settings, content types and entries.
- Authenticate through a scoped read-only token unless public delivery is
  explicitly enabled later.
- Receive predictable validated JSON.

## Initial Functional Requirements

### Authentication And Access

- Users can register and log in.
- Owner registration creates an organization automatically.
- Organization and site memberships are distinct.
- Organization owners can access all sites in their organization.
- Site-only collaborators can access only assigned sites.
- Platform administration is restricted independently.

### Organization Dashboard

- List and create sites.
- Enter each site dashboard directly.
- Manage organization members.
- View organization activity logs.
- View aggregated analytics when analytics are implemented.
- View relevant system and usage information.

### Site Dashboard

- Manage site settings.
- Manage site members.
- Create and update content types.
- Add, remove and reorder fields.
- Create and edit content entries.
- Publish and unpublish entries.
- Schedule future publication.
- Manage excerpts, SEO metadata and bulk editorial actions.
- Upload, edit, delete and select site-scoped media.
- Manage delivery API tokens.

### Content Modeling

- Content types are site-scoped custom post types with two explicit kinds.
- `COLLECTION` types hold repeatable items such as articles, services, products
  or events.
- `SINGLE` types represent standalone pages such as home, about or contact and
  hold exactly one backing item.
- Creation presets initialize blank collections, article collections and
  standalone pages without limiting later schema edits.
- Content schemas are versioned.
- Entry values are validated server-side.
- The initial field catalog includes rich structured fields.
- Nested groups are supported.
- Repeaters support add-row, remove-row and reorder-row operations.
- Media and gallery fields select assets from the site media library.
- Categories are hierarchical and tags are flat.
- Standalone pages share one Pages taxonomy scope.
- Every collection owns an isolated taxonomy scope so articles, services and
  other post types do not share terms accidentally.
- Taxonomy terms include built-in description and SEO metadata.
- Category and tag definitions support extra structured fields through the same
  dynamic field engine used for content entries.
- Content types explicitly enable the taxonomies available to their entries.
- Categories, tags and navigation menus are added before the first delivery API
  so frontend contracts include the editorial structure from the beginning.

### Delivery API

- External frontend projects are separate from the CMS.
- Delivery routes expose published content only.
- Every delivery request requires a hashed, read-only token scoped to one site.
- Delivery exposes settings, active content types, published entries and
  navigation menus.
- Entry lists support offset pagination, sorting and category/tag slug filters.
- OpenAPI JSON and interactive Swagger documentation are served by the API.
- Draft preview is a later capability.

## Initial Non-Functional Requirements

- Tenant isolation is enforced by the API.
- Versioned database migrations are required.
- Secrets are never committed.
- OpenAPI documentation is generated.
- Critical tenancy and validation behavior has automated tests.
- Documentation changes accompany implementation changes.

## Explicitly Deferred

- Public frontend theme
- Frontend SDK
- Page builder
- AI component generation
- Plugin system
- Microservices
- GraphQL
- Advanced analytics ingestion
- Flexible content blocks
- Localization

## Open Product Questions

- Should published delivery optionally be public per site?
- Which analytics are needed first: administration usage or visitor analytics?
- Should a site-only user with access to multiple invited sites receive a small
  personal site switcher?
