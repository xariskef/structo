# API Application

NestJS modular monolith scaffold.

Current bootstrap:

- Global API prefix: `/api/v1`
- Health endpoint: `/api/v1/health`
- OpenAPI UI: `/api/docs`

This directory will contain:

```text
src/modules/
  auth/
  users/
  organizations/
  organization-memberships/
  sites/
  site-memberships/
  invitations/
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
