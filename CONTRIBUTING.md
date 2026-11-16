# Contributing to Structo

Thanks for your interest in improving Structo. Bug reports, ideas,
documentation fixes and code are all welcome.

## Before You Start

- For bugs, open an issue with steps to reproduce.
- For larger changes or new features, open an issue first so we can agree on
  the approach before you spend time on it.
- Small fixes (typos, docs, obvious bugs) can go straight to a pull request.

## Development Setup

Follow [Getting Started](./README.md#getting-started) in the README. You need
Node.js 24 and a PostgreSQL database (a free Neon branch or a local Postgres
both work).

## Making Changes

1. Fork the repository and create a branch from `main`
   (`fix/media-upload-error`, `feat/relation-field`).
2. Keep the change focused on one thing.
3. Add or update tests for behavior changes.
4. Update the relevant file under `docs/` when you change behavior, API
   contracts, the data model or security assumptions.
5. Add database changes as a new Prisma migration
   (`corepack pnpm db:migrate`). Never edit an existing migration.

Before opening a pull request, make sure these pass:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm check-types
corepack pnpm test
```

CI runs the same checks on every pull request.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add relation field editor
fix(media): reject files larger than the limit
docs: explain webhook signature verification
```

## Code Style

- TypeScript everywhere; avoid `any`.
- Validate input at the boundary with the Zod schemas in `packages/contracts`.
- Check permissions on the server for every management route.
- Prettier and ESLint settle formatting questions.

## Dependencies

New dependencies should be stable releases, pinned to an exact version. See the
[Dependency Policy](./docs/DEPENDENCY_POLICY.md).

## Code of Conduct

By participating you agree to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
