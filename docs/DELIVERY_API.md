# Delivery API

## Purpose

The Delivery API exposes published Structo CMS content to external frontend
projects. It is read-only and separate from the session-authenticated management
API.

Base path:

```text
/api/v1/delivery
```

Interactive Swagger documentation:

```text
/api/v1/delivery/docs
/api/v1/delivery/openapi.json
```

## Authentication

Issue a token from a site's **Administration > API tokens** screen. The raw
`stk_...` value is shown once. Store it in the frontend deployment's secret
storage and send it as a Bearer token:

```http
Authorization: Bearer stk_EXAMPLE
```

Every delivery token belongs to one site and currently grants the
`content:read` scope. Missing, malformed, revoked or expired tokens receive
`401 Unauthorized`. A valid token used with another `siteKey` receives
`404 Not Found`.

## Endpoints

```text
GET /sites/:siteKey/settings
GET /sites/:siteKey/content-types
GET /sites/:siteKey/content-types/:typeSlug
GET /sites/:siteKey/content-types/:typeSlug/entries
GET /sites/:siteKey/content-types/:typeSlug/entries/:entrySlug
GET /sites/:siteKey/navigation-menus
GET /sites/:siteKey/navigation-menus/:menuKey
```

Content types are active structures only. Entries are published items only.
Entry responses embed taxonomy summaries as `{ kind, name, slug }` without
internal IDs. Navigation responses expose resolved URLs and omit stored
reference IDs. Declared rich-text fields are sanitized server-side before
delivery, including values nested in groups and repeater rows.

Dynamic `media` and `gallery` values are stored internally as site-scoped asset
IDs. Delivery responses hydrate those values into public media objects with URL,
filename, MIME type, size, optional image dimensions, alt text and caption.

## Entry Lists

Collection and single-page entry lists support:

| Parameter  | Default            | Notes                                             |
| ---------- | ------------------ | ------------------------------------------------- |
| `page`     | `1`                | Positive integer                                  |
| `pageSize` | `20`               | Positive integer, maximum `100`                   |
| `sort`     | `publishedAt:desc` | Also `publishedAt:asc`, `title:asc`, `title:desc` |
| `category` | none               | Category slug filter                              |
| `tag`      | none               | Tag slug filter                                   |

List responses include:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## Examples

```bash
curl \
  -H "Authorization: Bearer $STRUCTO_TOKEN" \
  "https://cms.example.com/api/v1/delivery/sites/$STRUCTO_SITE_KEY/content-types/articles/entries?page=1&pageSize=10&tag=featured"
```

```ts
const response = await fetch(
  `${process.env.STRUCTO_URL}/api/v1/delivery/sites/${process.env.STRUCTO_SITE_KEY}/navigation-menus/main`,
  {
    headers: {
      Authorization: `Bearer ${process.env.STRUCTO_TOKEN}`,
    },
  },
);

if (!response.ok)
  throw new Error(`Structo delivery failed: ${response.status}`);

const menu = await response.json();
```

## Errors

Validation errors use the shared API error envelope. Delivery consumers should
handle:

- `400 Bad Request`: invalid pagination, sort or filter value.
- `401 Unauthorized`: missing or invalid token.
- `404 Not Found`: wrong site binding or unpublished/missing resource.
