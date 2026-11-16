# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-16

First public release.

### Added

- Accounts, organizations and sites with organization and site roles, and
  invitations for single-site collaborators.
- Site settings with audit logging, plus organization and site activity logs.
- Content type builder for collections and pages with versioned schemas and
  nested group/repeater fields.
- Entries with draft, publish, unpublish and scheduled publishing, immutable
  revisions and published snapshots.
- Rich text editor, SEO fields, excerpts, bulk actions, duplication and JSON
  import/export.
- Categories and tags scoped to pages or to a collection, with custom fields.
- Navigation menus.
- Media library on Cloudflare R2 with optional per-site storage.
- Token-authenticated delivery API with OpenAPI documentation.
- Draft preview tokens and a Next.js Draft Mode guide.
- Signed webhooks.
- `@structo/sdk` delivery client.
- Platform operator console.

[Unreleased]: https://github.com/xariskef/structo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/xariskef/structo/releases/tag/v0.1.0
