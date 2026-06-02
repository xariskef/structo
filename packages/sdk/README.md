# @structo/sdk

Official JavaScript/TypeScript SDK for the [Structo CMS](https://github.com/your-org/structo) Delivery API.

- **Zero runtime dependencies** — uses the native `fetch` API
- **Dual ESM + CJS** output with full TypeScript declarations
- **Compatible** with Node.js 18+, all modern browsers, and edge runtimes (Vercel Edge, Cloudflare Workers)

## Installation

```bash
npm install @structo/sdk
# or
pnpm add @structo/sdk
```

## Quick start

```ts
import { StructoClient } from "@structo/sdk";

const client = new StructoClient({
  baseUrl: "https://cms.example.com/api/v1",
  siteKey: "my-site",
  token: process.env.STRUCTO_DELIVERY_TOKEN!,
});

const { data, meta } = await client.listEntries("articles");
```

## Configuration

```ts
import { StructoClient, type StructoClientOptions } from "@structo/sdk";

const options: StructoClientOptions = {
  /** Base URL of your Structo API (no trailing slash). */
  baseUrl: "https://cms.example.com/api/v1",

  /** Site key — the slug shown in Administration > Settings. */
  siteKey: "my-site",

  /** Delivery API token issued from Administration > API tokens. */
  token: process.env.STRUCTO_DELIVERY_TOKEN!,

  /**
   * Optional: preview token for draft content.
   * Required only when calling `getEntryDraft()`.
   * Obtain from Administration > Preview tokens or the entry editor sidebar.
   */
  previewToken: process.env.STRUCTO_PREVIEW_TOKEN,
};

const client = new StructoClient(options);
```

## API

### `getSettings()`

Returns public site settings including the site name and public base URL.

```ts
const settings = await client.getSettings();
console.log(settings.name);
console.log(settings.publicBaseUrl);
```

### `listContentTypes()`

Returns all active content types for the site.

```ts
const types = await client.listContentTypes();
for (const type of types) {
  console.log(type.slug, type.kind); // "articles" "COLLECTION"
}
```

### `getContentType(typeSlug)`

Returns a single content type by its slug.

```ts
const articlesType = await client.getContentType("articles");
```

### `listEntries(typeSlug, options?)`

Returns a paginated list of published entries.

```ts
const result = await client.listEntries("articles", {
  page: 1,
  pageSize: 10,
  sort: "publishedAt:desc",
  category: "news",
  tag: "featured",
});

console.log(result.meta.total);
for (const entry of result.data) {
  console.log(entry.title, entry.slug);
}
```

**Options:**

| Option     | Type     | Default              | Description                              |
| ---------- | -------- | -------------------- | ---------------------------------------- |
| `page`     | `number` | `1`                  | Page number                              |
| `pageSize` | `number` | `20`                 | Items per page (max 100)                 |
| `sort`     | `string` | `"publishedAt:desc"` | `publishedAt:asc/desc`, `title:asc/desc` |
| `category` | `string` | —                    | Filter by category slug                  |
| `tag`      | `string` | —                    | Filter by tag slug                       |

### `getEntry(typeSlug, entrySlug)`

Returns a single published entry by its content-type slug and entry slug.

```ts
const post = await client.getEntry("articles", "my-first-post");
console.log(post.title);
console.log(post.data); // dynamic field values
```

### `listMenus()`

Returns all navigation menus for the site.

```ts
const menus = await client.listMenus();
```

### `getMenu(menuKey)`

Returns a single navigation menu by its key.

```ts
const main = await client.getMenu("main");
for (const item of main.items) {
  console.log(item.label, item.url);
}
```

### `getEntryDraft(entryId)`

Returns the live working draft of an entry. Requires a `previewToken` to be set
in the client options.

```ts
// Throws StructoAuthError synchronously if previewToken is not configured.
const draft = await client.getEntryDraft("cm8abc123");
console.log(draft.title); // latest unsaved or saved draft value
```

### `getPreviewSession()`

Validates the configured preview token and returns its site and optional entry
scope. Frontend Draft Mode enable routes must call this before setting cookies.

```ts
const session = await client.getPreviewSession();
console.log(session.siteKey, session.entryId, session.expiresAt);
```

## Error handling

All methods throw typed SDK errors that extend `StructoError`.

```ts
import {
  StructoError,
  StructoAuthError,
  StructoNetworkError,
  StructoNotFoundError,
  StructoValidationError,
  StructoHttpError,
} from "@structo/sdk";

try {
  const entry = await client.getEntry("articles", "missing-slug");
} catch (err) {
  if (err instanceof StructoNotFoundError) {
    // 404 — entry does not exist or is not published
    return notFound();
  }
  if (err instanceof StructoAuthError) {
    // 401 — token invalid, expired, or revoked
    console.error("Token error:", err.message);
  }
  if (err instanceof StructoNetworkError) {
    // fetch() threw — network unreachable, DNS failure, etc.
    console.error("Network error:", err.cause);
  }
  if (err instanceof StructoHttpError) {
    // Unexpected HTTP status (5xx, etc.)
    console.error("HTTP", err.status, err.body);
  }
  if (err instanceof StructoError) {
    // Use .code to discriminate in a switch
    console.error(err.code, err.message);
  }
}
```

**Error codes:**

| Class                    | `.code`              | Cause                      |
| ------------------------ | -------------------- | -------------------------- |
| `StructoNetworkError`    | `"network_error"`    | `fetch()` threw            |
| `StructoAuthError`       | `"auth_error"`       | `401 Unauthorized`         |
| `StructoNotFoundError`   | `"not_found"`        | `404 Not Found`            |
| `StructoValidationError` | `"validation_error"` | `422 Unprocessable Entity` |
| `StructoHttpError`       | `"http_error"`       | Any other non-2xx response |

## Usage with Next.js App Router

### Published content (Server Component)

```ts
// app/articles/page.tsx
import { StructoClient, StructoNotFoundError } from "@structo/sdk";
import { notFound } from "next/navigation";

const client = new StructoClient({
  baseUrl: process.env.STRUCTO_API_URL!,
  siteKey: process.env.STRUCTO_SITE_KEY!,
  token: process.env.STRUCTO_DELIVERY_TOKEN!,
});

export default async function ArticlesPage() {
  const { data: articles, meta } = await client.listEntries("articles", {
    pageSize: 12,
    sort: "publishedAt:desc",
  });

  return (
    <main>
      <h1>Articles ({meta.total})</h1>
      <ul>
        {articles.map((a) => (
          <li key={a.id}>
            <a href={`/articles/${a.slug}`}>{a.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

### Static generation with `generateStaticParams`

```ts
// app/articles/[slug]/page.tsx
import { StructoClient, StructoNotFoundError } from "@structo/sdk";
import { notFound } from "next/navigation";

const client = new StructoClient({ /* ... */ });

export async function generateStaticParams() {
  const { data } = await client.listEntries("articles", { pageSize: 100 });
  return data.map((entry) => ({ slug: entry.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  try {
    const entry = await client.getEntry("articles", slug);
    return <article><h1>{entry.title}</h1></article>;
  } catch (err) {
    if (err instanceof StructoNotFoundError) notFound();
    throw err;
  }
}
```

### Draft preview with Next.js Draft Mode

See [docs/DRAFT_MODE.md](../../docs/DRAFT_MODE.md) for the complete setup
including the enable/disable Route Handlers and the `structo_preview` cookie
pattern.

```ts
// Short version — the content page:
import { cookies, draftMode } from "next/headers";
import { StructoClient, StructoNotFoundError } from "@structo/sdk";
import { notFound } from "next/navigation";

const publishedClient = new StructoClient({ /* ... */ });

export default async function ArticlePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { isEnabled } = await draftMode();

  if (isEnabled) {
    const { entryId } = await searchParams;
    const jar = await cookies();
    const previewToken = jar.get("structo_preview")?.value;
    if (!entryId || !previewToken) notFound();

    const previewClient = new StructoClient({
      baseUrl: process.env.STRUCTO_API_URL!,
      siteKey: process.env.STRUCTO_SITE_KEY!,
      token: process.env.STRUCTO_DELIVERY_TOKEN!,
      previewToken,
    });

    try {
      const draft = await previewClient.getEntryDraft(entryId);
      return <Article entry={draft} isDraft />;
    } catch (err) {
      if (err instanceof StructoNotFoundError) notFound();
      throw err;
    }
  }

  try {
    const entry = await publishedClient.getEntry("articles", slug);
    return <Article entry={entry} isDraft={false} />;
  } catch (err) {
    if (err instanceof StructoNotFoundError) notFound();
    throw err;
  }
}
```

## Usage with other frameworks

The SDK works anywhere `fetch` is available.

### Astro

```ts
// src/pages/articles/[slug].astro
---
import { StructoClient } from "@structo/sdk";

const client = new StructoClient({
  baseUrl: import.meta.env.STRUCTO_API_URL,
  siteKey: import.meta.env.STRUCTO_SITE_KEY,
  token: import.meta.env.STRUCTO_DELIVERY_TOKEN,
});

const { slug } = Astro.params;
const entry = await client.getEntry("articles", slug!);
---
<h1>{entry.title}</h1>
```

### SvelteKit

```ts
// src/routes/articles/[slug]/+page.server.ts
import { StructoClient, StructoNotFoundError } from "@structo/sdk";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const client = new StructoClient({
  baseUrl: import.meta.env.VITE_STRUCTO_API_URL,
  siteKey: import.meta.env.VITE_STRUCTO_SITE_KEY,
  token: import.meta.env.VITE_STRUCTO_DELIVERY_TOKEN,
});

export const load: PageServerLoad = async ({ params }) => {
  try {
    const entry = await client.getEntry("articles", params.slug);
    return { entry };
  } catch (err) {
    if (err instanceof StructoNotFoundError) error(404);
    throw err;
  }
};
```

## Environment variables reference

```bash
# Required
STRUCTO_API_URL=https://cms.example.com/api/v1
STRUCTO_SITE_KEY=my-site
STRUCTO_DELIVERY_TOKEN=stk_…

# Optional — only needed for draft preview
STRUCTO_PREVIEW_TOKEN=stp_…
```

## Build

```bash
pnpm --filter @structo/sdk build   # tsup → dist/
pnpm --filter @structo/sdk test    # vitest run
```
