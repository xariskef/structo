# Data Model

## Status

The identity, tenancy, site settings, audit log, content type and content entry
foundations are implemented through versioned Prisma migrations. Delivery,
media and later operational entities remain conceptual until their feature work
begins.

## Identity And Access

### User

Represents a person who can authenticate.

Core fields:

```text
id
email
name
status
createdAt
updatedAt
```

### PlatformOperatorAccess

Grants restricted platform administration access to a user. This is separate
from customer organization and site roles.

Core fields:

```text
id
userId
role
createdAt
updatedAt
```

Initial role:

```text
PLATFORM_ADMIN
```

### PasswordCredential

Stores one Argon2id password hash for a user.

Core fields:

```text
id
userId
passwordHash
createdAt
updatedAt
```

### AuthSession

Stores an administration session. The database stores a token hash, never the
raw token value sent in the session cookie.

Core fields:

```text
id
userId
tokenHash
expiresAt
createdAt
lastUsedAt
```

### Organization

Represents a customer, team or management workspace.

Core fields:

```text
id
name
slug
createdById
createdAt
updatedAt
```

### OrganizationMembership

Links a user to an organization.

Initial roles:

```text
OWNER
ADMIN
ANALYST
```

### Site

Represents one independently managed website or application.

Core fields:

```text
id
organizationId
name
key
slug
status
createdAt
updatedAt
```

### SiteMembership

Grants a user direct access to one site.

Initial roles:

```text
SITE_ADMIN
EDITOR
AUTHOR
VIEWER
```

Direct site membership is intended for collaborators who should not access the
organization dashboard.

### Implemented Identity And Tenancy Constraints

- User email is globally unique.
- Platform operator access is optional and unique per user.
- Organization slug is globally unique.
- Organization membership is unique per organization and user.
- Site public key is globally unique.
- Site slug is unique within its organization.
- Direct site membership is unique per site and user.
- Password credential ownership is unique per user.
- Session token hashes are globally unique.
- Invitation token hashes are globally unique.
- Deleting an organization cascades to its sites and memberships.
- Deleting a site cascades to its direct memberships.
- Organization creator deletion is restricted while owned organizations exist.

### Invitation

Represents an invitation to an organization or site.

Core fields:

```text
id
email
organizationId
siteId?
role
tokenHash
expiresAt
acceptedAt?
createdById
createdAt
```

An invitation grants either an organization role or a direct site role.
Invitation tokens are persisted as hashes, expire after seven days and can be
accepted once.

## Settings

### SiteSetting

Stores validated site configuration.

Proposed shape:

```text
id
siteId
key
valueJson
createdAt
updatedAt

unique(siteId, key)
```

Settings should be validated through typed contracts. Do not introduce a second
overlapping settings model.

Organization settings and platform settings can be added only when their scope
is clearly distinct.

## Content Modeling

### ContentType

Defines a site-specific content type. Its `kind` decides how it behaves:

- `COLLECTION` is a custom post type holding many items (posts, articles,
  services, products, events, team members).
- `SINGLE` is a standalone page (home, about, contact) backed by exactly one
  item.

`singularName` and `pluralName` provide natural administration labels.

Core fields:

```text
id
siteId
kind            COLLECTION | SINGLE
name
singularName?
pluralName?
slug
description?
status
fieldsJson
createdAt
updatedAt

unique(siteId, slug)
```

### ContentTypeVersion

Stores an immutable snapshot of a content type schema.

Core fields:

```text
id
contentTypeId
version
fieldsJson
createdById
createdAt

unique(contentTypeId, version)
```

### ContentEntry

Stores one item created from a content type.

Core fields:

```text
id
siteId
contentTypeId
contentTypeVersionId
title
slug
status
dataJson
excerpt?
seoTitle?
seoDescription?
publishedAt?
createdById
updatedById
createdAt
updatedAt

unique(contentTypeId, slug)
index(siteId, status)
index(status, publishedAt)
```

Initial statuses:

```text
DRAFT
SCHEDULED
PUBLISHED
ARCHIVED
```

A `SCHEDULED` entry stores its future go-live time in `publishedAt`; a worker
promotes it to `PUBLISHED` when due and records an immutable revision plus an
audit event. `excerpt`, `seoTitle` and `seoDescription` are built-in editorial
fields, separate from the dynamic custom fields in `dataJson`.

`contentTypeVersionId` records the schema version the entry was last validated
against. The editor renders the content type's current active version, and
saving, publishing or scheduling migrates the entry onto that version — so
fields added after creation appear on existing entries.

### TaxonomyDefinition

Defines one category or tag schema inside an explicit editorial scope.

```text
id
siteId
contentTypeId?
scope             PAGES | CONTENT_TYPE
scopeKey
kind              CATEGORY | TAG
fieldsJson
createdAt
updatedAt

unique(siteId, scopeKey, kind)
```

Standalone pages share the `pages` scope key. Every collection owns a separate
`content-type:<id>` scope key.

### TaxonomyDefinitionVersion

Stores an immutable snapshot whenever taxonomy custom fields are saved.

```text
id
taxonomyDefinitionId
version
fieldsJson
createdById?
createdAt

unique(taxonomyDefinitionId, version)
```

### TaxonomyTerm

Stores one scoped category or tag. Categories can form a hierarchy through
`parentId`; tags remain flat. Description and SEO metadata are built in, while
extra structured values live in `dataJson`.

```text
id
siteId
taxonomyDefinitionId
taxonomyDefinitionVersionId
kind
name
slug
description?
seoTitle?
seoDescription?
dataJson
parentId?
createdAt
updatedAt

unique(taxonomyDefinitionId, slug)
index(siteId, kind)
index(taxonomyDefinitionId)
index(parentId)
```

### ContentTypeTaxonomy

Enables a supported taxonomy for one content type.

```text
siteId
contentTypeId
taxonomy

primary(contentTypeId, taxonomy)
index(siteId, taxonomy)
```

### ContentEntryTaxonomyTerm

Assigns one taxonomy term to one content entry.

```text
siteId
entryId
termId

primary(entryId, termId)
index(siteId)
index(termId)
```

### ContentRevision

Stores an immutable snapshot of an entry.

Core fields:

```text
id
entryId
revision
dataJson
status
createdById
createdAt

unique(entryId, revision)
```

## Delivery

### SiteApiToken

Grants external frontend access to one site.

Core fields:

```text
id
siteId
name
tokenHash
scopes
lastUsedAt?
expiresAt?
revokedAt?
createdAt
```

Raw token values are shown only once when created. The database stores a hash.

Initial scope:

```text
content:read
```

## Media

### MediaAsset

Stores metadata for a site-owned media file.

Core fields:

```text
id
siteId
storageProvider
storageKey
url
filename
mimeType
size
width?
height?
alt?
caption?
createdById
createdAt
updatedAt
```

## Operations

### AuditLog

Records important management changes.

Core fields:

```text
id
organizationId
siteId?
actorUserId?
action
entityType
entityId?
metadataJson?
createdAt
```

### AnalyticsEvent

Reserved for later analytics work.

The initial implementation should define the intended event boundary before
collecting visitor data.

## Tenancy Invariants

- Platform operator access is explicit and separate from customer membership.
- Every `Site` belongs to one `Organization`.
- Every site-owned record contains `siteId`.
- Every site-scoped query checks access to the requested site.
- Slugs are unique within the smallest meaningful tenant scope.
- Content entries record the schema version used for their latest validation.
- A `SINGLE` content type has exactly one backing item after first access.
- Single-page first creation is serialized in the service layer and its backing
  item can be archived or removed only through the parent content type.
- Incomplete entry drafts are allowed while editing.
- Saving, publishing and scheduling move entries to the current active schema
  version. Migration prunes keys removed by newer schemas.
- Publishing and scheduling require strict validation against the current active
  content type version.
- Taxonomy definitions, terms, content-type taxonomy opt-ins and entry
  assignments are explicitly site-scoped.
- Standalone pages share one taxonomy scope. Every collection owns an isolated
  taxonomy scope.
- Taxonomy schemas use immutable versions and term custom data is validated
  against the latest schema when saved.
- Categories can reference parents only inside the same taxonomy definition and
  cannot form ancestry cycles. Tags cannot have parents.
- Entry taxonomy assignments accept only terms enabled for that content type.
- Entry taxonomy assignments reject terms from another collection scope.
- Published delivery queries never return drafts.
