# API Application

NestJS modular monolith scaffold.

Current bootstrap:

- Global API prefix: `/api/v1`
- Health endpoint: `/api/v1/health`
- OpenAPI UI: `/api/docs`
- Owner registration and session endpoints: `/api/v1/manage/auth/*`
- Tenant endpoints: `/api/v1/manage/organizations/*` and
  `/api/v1/manage/sites/*`
- Invitation endpoints: `/api/v1/manage/*/invitations`

Implemented modules:

```text
src/modules/
  auth/
  authorization/
  content-types/
  database/
  entries/
  health/
  invitations/
  organizations/
  settings/
  sites/
```

Later modules:

```text
src/modules/
  users/
  organization-memberships/
  site-memberships/
  media/
  api-tokens/
  delivery/
  audit-logs/
  analytics/
  platform-admin/
```

Content types are generic site-scoped custom post types. Entries remain bound
to an immutable activated schema version, permit incremental draft editing and
require strict validation before publishing.

The remaining feature modules are added milestone by milestone. External
dependencies are pinned after live registry verification.
