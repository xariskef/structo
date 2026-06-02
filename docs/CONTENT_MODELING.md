# Content Modeling

## Goal

Allow a site administrator to model rich structured content without changing
application code.

The field system is a core product capability. It must be correct before page
builders or other advanced presentation features are considered.

## Custom Post Types

Structo keeps the useful custom post-type model from the reference project.
Each site can create repeatable collections such as:

```text
posts
articles
services
products
events
```

It can also create standalone pages such as:

```text
home
about
contact
```

These are all `ContentType` records. A `COLLECTION` holds many `ContentEntry`
records. A `SINGLE` page is backed by exactly one `ContentEntry`. Both kinds use
the same schema builder, validation and revision system. New editorial
collections or pages do not require new database tables or application code.

A single page is archived as a content type. Its backing item is not archived
independently.

## Content Type Presets

Creation presets are small initializers, not permanent content type classes.
They reduce repetitive setup while preserving the flexibility of the custom
post-type model:

```text
blank    collection with the built-in rich-text content field
article  collection with content plus categories and tags enabled
page     standalone page with the built-in rich-text content field
```

After creation, an administrator can edit the schema and enabled taxonomies
through the normal structure editor. Presets do not require separate database
tables and do not restrict future field changes.

## Taxonomies

Structo supports two editorial taxonomy kinds:

```text
CATEGORY  hierarchical
TAG       flat
```

Taxonomy terms do not live in one ambiguous site-wide pool. Standalone pages
share one `PAGES` scope. Every collection receives its own `CONTENT_TYPE` scope,
so an Articles category cannot be assigned to a Services item.

Each category and tag definition stores a versioned custom field schema using
the same field engine as content entries. Terms always include:

```text
name
slug
description
seoTitle
seoDescription
```

Extra values such as an icon, archive image, color, rich introduction or nested
metadata live in term `dataJson`. Existing terms render the latest definition
schema and move to its latest immutable version when saved. Removed custom keys
are pruned during that migration.

Entry and taxonomy SEO metadata remains built in rather than becoming dynamic
custom fields. Their administration forms share one reusable SEO control so
meta title and description limits stay consistent.

Each content type explicitly enables the taxonomy kinds its entries can use.
Entry assignments are validated server-side: a term must belong to the same
site, its scope must match the entry, and its taxonomy kind must be enabled.
Disabling a taxonomy from a content type removes stale assignments of that kind.

## Storage Strategy

Each content type has an immutable versioned schema. Each content entry stores
its values in JSONB and references the schema version used for validation.

```text
ContentType
  ContentTypeVersion.schemaJson

ContentEntry
  contentTypeVersionId
  dataJson
```

This provides flexibility while preserving validation and revision history.

## Initial Field Types

### Primitive Fields

```text
text
textarea
number
boolean
url
email
color
```

### Choice Fields

```text
select
multiselect
```

### Date And Time Fields

```text
date
datetime
time
```

### Content Fields

```text
richtext
```

`richText` values are edited with TipTap and stored as HTML inside entry JSON.
Stored HTML is untrusted content. The Delivery API sanitizes every declared
`richText` value before returning it, including values nested in groups and
repeater rows. The allowlist keeps baseline TipTap formatting and safe links
while removing executable tags, unsafe attributes and unsafe link schemes.

### Media Fields

```text
media
gallery
```

### Relationship Fields

```text
relation
```

A relation points to one or more entries of an allowed content type.

### Structural Fields

```text
group
repeater
```

`group` nests a fixed set of child fields.

`repeater` is the add-row capability. It contains child fields and allows an
editor to add, remove and reorder rows.

Example:

```json
{
  "key": "faq",
  "type": "repeater",
  "label": "FAQ",
  "children": [
    {
      "key": "question",
      "type": "text",
      "label": "Question",
      "required": true
    },
    {
      "key": "answer",
      "type": "richtext",
      "label": "Answer",
      "required": true
    }
  ]
}
```

## Field Definition Contract

Every field requires:

```text
id
key
type
label
required
order
```

Optional common properties:

```text
description
placeholder
defaultValue
validation
settings
```

Field keys must be stable after a content type version is activated. Renaming a
key is a schema migration, not a cosmetic edit.

## Validation

Validation occurs in two layers:

1. Validate the content type schema itself.
2. Validate each content entry against the current active schema version when it
   is saved, published or scheduled.

Implemented tools:

- Zod for static API DTOs.
- Zod schemas generated from active field definitions for dynamic entry data.

The administration UI must not be the only validation layer.

Groups and repeaters are recursively configurable in the structure editor.
Nesting is capped at five levels in both the UI and server-side activation
validation so schemas remain understandable and rendering work stays bounded.

## Versioning Rules

- Draft schema edits can change freely before activation.
- Activating a changed schema creates a new immutable version.
- Existing entries record the schema version they were last validated against.
- Entry drafts can be incomplete while editors work on them.
- Saving, publishing or scheduling migrates an entry to the current active
  schema version.
- Controlled migration removes keys deleted by a newer schema, including nested
  group and repeater keys. Normal writes still reject undeclared keys.
- Publishing and scheduling validate every required field against the current
  active schema version.

## Later Extensions

Not part of the first implementation:

- Flexible content blocks
- Localization per field
- Conditional fields
- Computed fields
- Custom field plugins
- Field-level permissions
