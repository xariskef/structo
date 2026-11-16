# API

NestJS modular monolith that serves both the management API used by the admin
app and the public delivery API used by frontends.

- Global prefix: `/api/v1`
- Health check: `GET /api/v1/health`
- OpenAPI UI: `/api/docs`
- Management API: `/api/v1/manage/*` (session-authenticated)
- Delivery API: `/api/v1/delivery/sites/:siteKey/*` (site API token, OpenAPI
  at `/api/v1/delivery/docs`)
- Draft preview: `/api/v1/preview/*` (short-lived preview token)
- Platform console: `/api/v1/platform/*` (platform operators only)

## Modules

```text
src/modules/
  auth/            registration, login, sessions
  authorization/   roles, permissions and guards
  organizations/   organizations and members
  sites/           sites inside an organization
  invitations/     organization and site invitations
  settings/        per-site settings
  site-storage/    per-site R2 configuration (encrypted secrets)
  content-types/   collections and pages, schema versions, import/export
  entries/         items, revisions, publishing and scheduling
  taxonomies/      categories and tags
  navigation/      navigation menus
  media/           media library
  api-tokens/      delivery API tokens
  preview-tokens/  draft preview tokens
  delivery/        public read-only delivery API
  webhooks/        signed webhook delivery
  audit-logs/      organization and site activity logs
  platform/        platform operator console
  health/          health check
  database/        Prisma client provider
```

Content types are site-scoped custom post types. Entries are bound to an
immutable schema version, allow incremental draft editing and are strictly
validated before publishing.

## Scripts

```bash
corepack pnpm --filter @structo/api dev
corepack pnpm --filter @structo/api test
```
