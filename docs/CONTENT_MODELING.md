# Content Modeling

## Goal

Allow a site administrator to model rich structured content without changing
application code.

The field system is a core product capability. It must be correct before page
builders or other advanced presentation features are considered.

## Custom Post Types

Structo keeps the useful custom post-type model from the reference project.
Each site can create collections such as:

```text
pages
posts
articles
services
products
events
```

These are all `ContentType` records. Their individual items are
`ContentEntry` records. New editorial collections do not require new database
tables or application code.

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

Rich text should be stored as editor JSON, not arbitrary HTML.

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
2. Validate each content entry against its referenced schema version.

Implemented tools:

- Zod for static API DTOs.
- Zod schemas generated from active field definitions for dynamic entry data.

The administration UI must not be the only validation layer.

## Versioning Rules

- Draft schema edits can change freely before activation.
- Activating a changed schema creates a new immutable version.
- Existing entries keep their original schema version until migrated.
- Entry drafts can be incomplete while editors work on them.
- Publishing validates every required field against the referenced immutable
  schema version.
- Entry edits should provide a controlled migration path when a newer content
  type version exists.

## Later Extensions

Not part of the first implementation:

- Flexible content blocks
- Localization per field
- Conditional fields
- Computed fields
- Custom field plugins
- Field-level permissions
