# Database

## Decision

Structo CMS uses a remote Neon PostgreSQL database.

A local PostgreSQL Docker service is not part of the initial scaffold.

## Connection Strategy

Use separate environment variables for runtime queries and Prisma migrations:

```bash
# Pooled Neon connection for the running API.
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require"

# Direct Neon connection for Prisma CLI migrations.
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DATABASE?sslmode=require"
```

Rules:

- Use `DATABASE_URL` for runtime application traffic.
- Use `DIRECT_URL` for Prisma CLI operations such as migrations.
- Store local development values in the ignored root `.env` file.
- Store deployment values in the hosting provider's secret storage.
- Environment variables supplied by the deployment environment take
  precedence over values in the local root `.env`.
- Store real values only in ignored local environment files or deployment
  secret storage.
- Commit placeholders only in `.env.example`.
- Never paste production credentials into documentation.

## Prisma Workflow

Prisma ORM 7 keeps connection URLs in `packages/database/prisma.config.ts`
instead of the Prisma schema. The CLI configuration uses `DIRECT_URL`:

```ts
datasource: {
  url: env('DIRECT_URL'),
}
```

The runtime database client uses the pooled `DATABASE_URL` with Prisma's Neon
adapter. Prisma ORM 7 removed the older `datasource.directUrl` configuration
property, so the CLI and runtime connection concerns are separated explicitly.

Root workflow:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:studio
```

Use versioned Prisma migrations. Do not use manual production schema changes as
the normal workflow.

## Current Migrations

```text
20260530221500_init_identity_tenancy
20260531113000_add_auth_sessions_invitations
```

The first migration creates the identity and tenancy foundation. The second
adds password credentials, opaque server-side sessions and invitations. They
were generated offline from the validated Prisma schema and have not been
applied to Neon yet. Apply them only after adding rotated local credentials to
the ignored root `.env`.

## Neon Setup Checklist

Before the first migration:

1. Create a Neon project.
2. Select the PostgreSQL version supported by the current stable toolchain.
3. Create a development branch and database.
4. Copy both pooled and direct connection strings.
5. Add local `DATABASE_URL` and `DIRECT_URL` values.
6. Confirm that local environment files are ignored by Git.
7. Run the initial versioned migration only after the Phase 1 scaffold exists.

## Future Environments

Use separate Neon branches or projects for development, staging and production.
Do not share one mutable database across all environments.

## Official References

- [Prisma ORM with Neon](https://docs.prisma.io/docs/v6/orm/overview/databases/neon)
- [Prisma config reference](https://docs.prisma.io/docs/orm/reference/prisma-config-reference)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Connect Neon to your stack](https://neon.com/docs/get-started-with-neon/connect-neon)
