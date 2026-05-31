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
  database/
  organizations/
  sites/
  invitations/
  health/
```

Later modules:

```text
src/modules/
  users/
  organization-memberships/
  site-memberships/
  settings/
  content-types/
  entries/
  media/
  api-tokens/
  delivery/
  audit-logs/
  analytics/
  platform-admin/
```

The remaining feature modules are added milestone by milestone. External NestJS
dependencies are pinned after live registry verification.
