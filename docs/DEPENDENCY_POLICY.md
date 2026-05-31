# Dependency Policy

## Goal

Use modern stable dependencies without relying on stale assumptions or
unreviewed prerelease packages.

## Core Rule

Before adding or upgrading a dependency:

1. Query the live package registry.
2. Inspect distribution tags and exclude prerelease channels.
3. Check official documentation or release notes when compatibility matters.
4. Select the latest stable compatible release.
5. Record the selected version, verification date and relevant notes below.
6. Run the appropriate checks and commit the lockfile.

Do not rely on AI model memory for current package versions.

## Stable Release Definition

Accept:

- Stable releases without prerelease suffixes.
- The registry `latest` tag when it points to a stable release and is compatible
  with the selected stack.

Reject by default:

- `alpha`
- `beta`
- `rc`
- `canary`
- `experimental`
- `next`
- Framework-specific preview channels

An exception requires an accepted entry in `docs/DECISIONS.md`.

## Runtime Policy

For Node.js, use the latest supported active LTS release at scaffold time.

Reason:

- A short-lived Current Node.js release can be stable but is usually not the
  right production baseline.
- Framework support requirements must be checked before selecting the runtime.

## Verification Commands

Use live registry commands when the scaffold exists:

```bash
pnpm view <package> version
pnpm view <package> dist-tags --json
pnpm outdated --recursive
```

Use official project documentation and release notes to verify major-version
compatibility.

## Versioning Rules

- Pin the `packageManager` version in the root `package.json`.
- Commit `pnpm-lock.yaml`.
- Use workspace references for internal packages.
- Review major upgrades intentionally.
- Do not run automated upgrade commands without reviewing the resulting changes.
- Update this document whenever the selected baseline or an important
  compatibility constraint changes.

## Initial Live Verification

Verified on: `2026-05-30`

The Phase 1 dependency baseline was queried from the live registry, checked for
stable `latest` tags and installed with pnpm. The generated lockfile is the
reproducible dependency source for this scaffold and must be committed when the
repository is initialized.

Current official documentation checks:

| Area              | Verified observation                                                                                                                                                         | Source                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| npm registry tags | Packages can publish separate tags such as `latest`, `beta`, `next` and `canary`. Installing an unqualified package resolves the `latest` tag by default.                    | [npm dist-tags documentation](https://docs.npmjs.com/cli/dist-tag/)                    |
| npm prereleases   | Stable version ranges exclude prereleases by default unless prereleases are explicitly included.                                                                             | [npm install documentation](https://docs.npmjs.com/cli/v11/commands/npm-install/)      |
| Next.js           | The official installation guide uses `create-next-app@latest` and documents a minimum Node.js version of `20.9`.                                                             | [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) |
| NestJS            | The official NestJS v11 migration guide documents Express v5 as the default integration, Fastify v5 support and a Node.js requirement of version `20` or higher.             | [NestJS migration guide](https://docs.nestjs.com/migration-guide)                      |
| Prisma ORM 7      | Connection URLs belong in `prisma.config.ts`. For Neon, Prisma documents `DIRECT_URL` for CLI operations and a pooled `DATABASE_URL` with `@prisma/adapter-neon` at runtime. | [Prisma ORM with Neon](https://docs.prisma.io/docs/v6/orm/overview/databases/neon)     |

## Baseline Inventory

Verified Phase 1 baseline:

| Dependency         | Selected stable version | Verified on  | Compatibility notes                                                                                                                       |
| ------------------ | ----------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js active LTS | `24.16.0`               | `2026-05-30` | Active LTS `Krypton`; pinned in `.nvmrc` and `.node-version`; package engine accepts compatible Node 24.x installations                   |
| pnpm               | `11.5.0`                | `2026-05-30` | Stable registry `latest`; pinned in `packageManager`                                                                                      |
| Corepack           | `0.35.0`                | `2026-05-30` | Stable registry `latest`; used in CI with Node `24.16.0`                                                                                  |
| Turborepo          | `2.9.16`                | `2026-05-30` | Stable registry `latest`                                                                                                                  |
| NestJS             | `11.1.24`               | `2026-05-30` | Stable registry `latest`; default Express adapter                                                                                         |
| Express            | Transitive through Nest | `2026-05-30` | Installed through `@nestjs/platform-express`                                                                                              |
| Next.js            | `16.2.6`                | `2026-05-30` | Stable registry `latest`; paired with React `19.2.6`                                                                                      |
| React              | `19.2.6`                | `2026-05-30` | Stable registry `latest`; paired with Next.js `16.2.6`                                                                                    |
| ESLint             | `9.39.4`                | `2026-05-30` | Latest compatible stable maintenance release; ESLint `10.4.1` is not yet supported by transitive plugins from `eslint-config-next@16.2.6` |
| Prisma ORM         | `7.8.0`                 | `2026-05-30` | Stable registry `latest`; Neon adapter uses the same version                                                                              |
| Neon PostgreSQL    | Remote managed database | `2026-05-30` | Pooled runtime URL and direct migration URL are configured separately                                                                     |
| Zod                | `4.4.3`                 | `2026-05-30` | Stable registry `latest`; install when static validation implementation begins                                                            |
| Ajv                | `8.20.0`                | `2026-05-30` | Stable registry `latest`; install when dynamic validation implementation begins                                                           |
| TypeScript         | `6.0.3`                 | `2026-05-30` | Stable registry `latest`; supported by selected toolchain                                                                                 |

## Continuous Integration

The initial GitHub Actions workflow was verified on `2026-05-30` against the
official action release pages:

| Action               | Selected stable version | Source                                                              |
| -------------------- | ----------------------- | ------------------------------------------------------------------- |
| `actions/checkout`   | `v6.0.2`                | [Official releases](https://github.com/actions/checkout/releases)   |
| `actions/setup-node` | `v6.4.0`                | [Official releases](https://github.com/actions/setup-node/releases) |
