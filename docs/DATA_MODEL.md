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
publishedAt?
createdById
updatedById
createdAt
updatedAt

unique(contentTypeId, slug)
index(siteId, status)
```

Initial statuses:

```text
DRAFT
PUBLISHED
ARCHIVED
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
- Content entries are validated against the stored content type version.
- Incomplete entry drafts are allowed while editing.
- Publishing requires strict validation against the referenced immutable
  content type version.
- Published delivery queries never return drafts.
