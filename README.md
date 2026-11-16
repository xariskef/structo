# Structo

A multi-site headless CMS built with NestJS, Next.js and PostgreSQL.

One account can run several organizations, each organization can own many
independent sites, and every site defines its own content model. Frontends read
published content through a token-authenticated delivery API or the
`@structo/sdk` client.

> Structo is an early `0.1` release. The core is tested and usable, but APIs
> may still change. Feedback and contributions are very welcome.

## Features

**Content modeling**

- Collections (repeatable, like custom post types) and standalone pages
- Visual field builder with text, rich text, number, boolean, select, date,
  color, media, gallery, nested groups, repeaters and more
- Versioned schemas: entries are validated against the active version and
  migrated when the schema changes
- Categories and tags with their own custom fields
- Navigation menus with nested items

**Editorial**

- Rich text editor (TipTap), SEO fields and excerpts
- Draft, publish, unpublish and scheduled publishing
- Immutable revisions and published snapshots — editing a draft never changes
  what is live
- Bulk actions, duplication, JSON import and export
- Media library on Cloudflare R2, with optional per-site buckets

**Multi-site and access**

- Organizations → sites, with organization roles (owner, admin, analyst) and
  site roles (site admin, editor, author, viewer)
- Invite external collaborators to a single site
- Activity logs per organization and per site
- Separate platform operator console

**Delivery**

- Read-only delivery API with per-site API tokens and OpenAPI docs
- Short-lived draft preview tokens (Next.js Draft Mode guide included)
- Signed webhooks (HMAC-SHA256) on publish, unpublish, schedule and delete
- `@structo/sdk`: zero-dependency TypeScript client (ESM and CJS)

## Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| API      | NestJS 11, Zod 4                                     |
| Admin    | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui      |
| Database | PostgreSQL with Prisma 7 (Neon works out of the box) |
| Storage  | Cloudflare R2 (S3-compatible)                        |
| Tooling  | pnpm workspaces, Turborepo, Playwright               |

## Repository Structure

```text
apps/
  api/          NestJS API (management, delivery, preview, platform)
  admin/        Next.js admin dashboard

packages/
  database/     Prisma schema, migrations and client
  contracts/    Shared API types and Zod schemas
  field-kit/    Field type registry and runtime validation
  storage/      Storage interface and R2 provider
  ui/           Shared admin UI components
  sdk/          @structo/sdk delivery client
```

## Getting Started

Requirements: Node.js 24 and Corepack (ships with Node). pnpm is pinned in
`package.json` and used through `corepack pnpm`.

```bash
git clone https://github.com/xariskef/structo.git
cd structo
corepack pnpm install
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — pooled PostgreSQL connection used at runtime
- `DIRECT_URL` — direct connection used for migrations
- `R2_*` — only needed for media uploads
- `STORAGE_ENCRYPTION_KEY` — only needed for per-site storage
  (`openssl rand -hex 32`)

Then create the database schema and start both apps:

```bash
corepack pnpm db:generate
corepack pnpm db:deploy
corepack pnpm dev
```

- Admin: http://localhost:3000
- API: http://localhost:3001/api/v1 (OpenAPI at http://localhost:3001/api/docs)

Register the first account in the admin, create an organization and a site, and
start modeling content.

## Using Content In A Frontend

Create a delivery token under the site's API tokens, then:

```ts
import { StructoClient } from "@structo/sdk";

const structo = new StructoClient({
  baseUrl: "http://localhost:3001/api/v1",
  siteKey: "my-site",
  token: process.env.STRUCTO_DELIVERY_TOKEN!,
});

const { data: articles } = await structo.listEntries("articles");
```

See the [SDK README](./packages/sdk/README.md) for Next.js, Astro and SvelteKit
examples, and [Draft Mode](./docs/DRAFT_MODE.md) for previews.

## Scripts

```bash
corepack pnpm dev            # API and admin in watch mode
corepack pnpm build          # build everything
corepack pnpm test           # unit tests
corepack pnpm lint           # ESLint
corepack pnpm check-types    # TypeScript
corepack pnpm format         # Prettier
corepack pnpm db:migrate     # create a migration in development
corepack pnpm db:studio      # Prisma Studio
```

End-to-end tests (both apps must be running):

```bash
corepack pnpm --filter @structo/admin test:e2e
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Content Modeling](./docs/CONTENT_MODELING.md)
- [API Design](./docs/API_DESIGN.md)
- [Delivery API](./docs/DELIVERY_API.md)
- [Security](./docs/SECURITY.md)
- [Architecture Decisions](./docs/DECISIONS.md)
- [All docs](./docs/README.md)

## Roadmap

Ideas where help is welcome:

- Starter frontend theme built on the SDK
- Relation fields between entries (the field type exists, the editor does not
  support it yet)
- Visual page builder blocks
- Localization (multi-language content)
- Image transformations and focal points
- More storage providers (S3, local disk)
- Docker Compose setup for local development

Have another idea? Open an issue.

## Contributing

Contributions of any size are welcome. Please read
[CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request, and report
security issues privately as described in [SECURITY.md](./.github/SECURITY.md).

## License

[MIT](./LICENSE) © Charis Kefallinos
