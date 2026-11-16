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

The initial dependency baseline was queried from the live registry, checked for
stable `latest` tags and installed with pnpm. The generated lockfile is the
reproducible dependency source for this scaffold and must be committed when the
repository is initialized.

Current official documentation checks:

| Area              | Verified observation                                                                                                                                                         | Source                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| npm registry tags | Packages can publish separate tags such as `latest`, `beta`, `next` and `canary`. Installing an unqualified package resolves the `latest` tag by default.                    | [npm dist-tags documentation](https://docs.npmjs.com/cli/dist-tag/)                                        |
| npm prereleases   | Stable version ranges exclude prereleases by default unless prereleases are explicitly included.                                                                             | [npm install documentation](https://docs.npmjs.com/cli/v11/commands/npm-install/)                          |
| Next.js           | The official installation guide uses `create-next-app@latest` and documents a minimum Node.js version of `20.9`.                                                             | [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation)                     |
| NestJS            | The official NestJS v11 migration guide documents Express v5 as the default integration, Fastify v5 support and a Node.js requirement of version `20` or higher.             | [NestJS migration guide](https://docs.nestjs.com/migration-guide)                                          |
| Prisma ORM 7      | Connection URLs belong in `prisma.config.ts`. For Neon, Prisma documents `DIRECT_URL` for CLI operations and a pooled `DATABASE_URL` with `@prisma/adapter-neon` at runtime. | [Prisma ORM with Neon](https://docs.prisma.io/docs/v6/orm/overview/databases/neon)                         |
| NestJS throttling | NestJS documents `@nestjs/throttler` as its rate-limiting package and supports global guard registration.                                                                    | [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting)                                     |
| NestJS scheduling | NestJS documents `@nestjs/schedule`, `ScheduleModule.forRoot()` and declarative `@Cron()` jobs.                                                                              | [NestJS task scheduling](https://docs.nestjs.com/techniques/task-scheduling)                               |
| TipTap React      | TipTap documents `@tiptap/react`, `@tiptap/pm` and `@tiptap/starter-kit` for React, plus `immediatelyRender: false` for SSR.                                                 | [TipTap React guide](https://tiptap.dev/docs/editor/getting-started/install/react)                         |
| HTML sanitization | `sanitize-html` documents parser-based cleanup with configurable allowed tags and per-element allowed attributes.                                                            | [sanitize-html README](https://github.com/apostrophecms/sanitize-html)                                     |
| Cloudflare R2     | Cloudflare documents its S3-compatible endpoint and AWS SDK for JavaScript v3 configuration with region `auto`.                                                              | [Cloudflare R2 S3 SDK guide](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)             |
| Password hashing  | OWASP recommends Argon2id and documents a minimum configuration of `19 MiB`, `2` iterations and parallelism `1`.                                                             | [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) |

## Baseline Inventory

Verified initial baseline:

| Dependency           | Selected stable version | Verified on  | Compatibility notes                                                                                                                         |
| -------------------- | ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js active LTS   | `24.16.0`               | `2026-05-30` | Active LTS `Krypton`; pinned in `.nvmrc` and `.node-version`; package engine accepts compatible Node 24.x installations                     |
| pnpm                 | `11.5.0`                | `2026-05-30` | Stable registry `latest`; pinned in `packageManager`                                                                                        |
| Corepack             | `0.35.0`                | `2026-05-30` | Stable registry `latest`; used in CI with Node `24.16.0`                                                                                    |
| Turborepo            | `2.9.16`                | `2026-05-30` | Stable registry `latest`                                                                                                                    |
| NestJS               | `11.1.24`               | `2026-05-30` | Stable registry `latest`; default Express adapter                                                                                           |
| Express              | Transitive through Nest | `2026-05-30` | Installed through `@nestjs/platform-express`                                                                                                |
| Next.js              | `16.2.6`                | `2026-05-30` | Stable registry `latest`; paired with React `19.2.6`                                                                                        |
| React                | `19.2.6`                | `2026-05-30` | Stable registry `latest`; paired with Next.js `16.2.6`                                                                                      |
| ESLint               | `9.39.4`                | `2026-05-30` | Latest compatible stable maintenance release; ESLint `10.4.1` is not yet supported by transitive plugins from `eslint-config-next@16.2.6`   |
| Prisma ORM           | `7.8.0`                 | `2026-05-30` | Stable registry `latest`; Neon adapter uses the same version                                                                                |
| Neon PostgreSQL      | Remote managed database | `2026-05-30` | Pooled runtime URL and direct migration URL are configured separately                                                                       |
| Zod                  | `4.4.3`                 | `2026-05-31` | Stable registry `latest`; installed for shared static API input contracts                                                                   |
| Ajv                  | `8.20.0`                | `2026-05-30` | Stable registry `latest`; reserved for optional future JSON Schema interoperability, not required by the current generated Zod runtime path |
| TypeScript           | `6.0.3`                 | `2026-05-30` | Stable registry `latest`; supported by selected toolchain                                                                                   |
| argon2               | `0.44.0`                | `2026-05-31` | Stable registry `latest`; Argon2id password hashing                                                                                         |
| @nestjs/throttler    | `6.5.0`                 | `2026-05-31` | Stable registry `latest`; API and authentication endpoint rate limiting                                                                     |
| @types/express       | `5.0.6`                 | `2026-05-31` | Stable registry `latest`; explicit request and response types for cookie transport                                                          |
| @playwright/test     | `1.60.0`                | `2026-05-31` | Stable registry `latest`; Chromium administration E2E runner                                                                                |
| Tailwind CSS         | `4.3.0`                 | `2026-05-31` | Stable registry `latest`; shared shadcn/ui styling baseline                                                                                 |
| radix-ui             | `1.4.3`                 | `2026-05-31` | Stable registry `latest`; shared shadcn/ui primitive bundle                                                                                 |
| lucide-react         | `1.17.0`                | `2026-05-31` | Stable registry `latest`; administration icon set                                                                                           |
| tsx                  | `4.22.4`                | `2026-05-31` | Stable registry `latest`; NestJS API development runner                                                                                     |
| @nestjs/schedule     | `6.1.3`                 | `2026-06-01` | Stable registry `latest`; minute-based scheduled publishing worker                                                                          |
| @tiptap/react        | `3.24.0`                | `2026-06-01` | Stable registry `latest`; React editor bindings                                                                                             |
| @tiptap/pm           | `3.24.0`                | `2026-06-01` | Stable registry `latest`; direct dependency recommended by the official TipTap React guide                                                  |
| @tiptap/starter-kit  | `3.24.0`                | `2026-06-01` | Stable registry `latest`; baseline rich-text extensions                                                                                     |
| @tiptap/extensions   | `3.24.0`                | `2026-06-01` | Stable registry `latest`; placeholder extension                                                                                             |
| sanitize-html        | `2.17.4`                | `2026-06-01` | Stable registry `latest`; parser-based server-side Delivery API rich-text sanitization                                                      |
| @types/sanitize-html | `2.16.1`                | `2026-06-01` | Stable registry `latest`; TypeScript declarations for `sanitize-html`                                                                       |
| @aws-sdk/client-s3   | `3.1058.0`              | `2026-06-02` | Stable registry `latest`; official S3 client used by the Cloudflare R2 storage adapter                                                      |
| tsup                 | `8.5.1`                 | `2026-06-02` | Stable registry `latest`; bundles `@structo/sdk` to ESM + CJS with `.d.ts` declarations; dev-only in `packages/sdk`                         |
| vitest               | `4.1.8`                 | `2026-06-02` | Stable registry `latest`; test runner for `packages/sdk`; dev-only                                                                          |

## Continuous Integration

The initial GitHub Actions workflow was verified on `2026-05-30` against the
official action release pages:

| Action               | Selected stable version | Source                                                              |
| -------------------- | ----------------------- | ------------------------------------------------------------------- |
| `actions/checkout`   | `v6.0.2`                | [Official releases](https://github.com/actions/checkout/releases)   |
| `actions/setup-node` | `v6.4.0`                | [Official releases](https://github.com/actions/setup-node/releases) |
