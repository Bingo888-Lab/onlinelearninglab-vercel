# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-10-01

### Changed

- Require an explicit manual confirmation before CI runs E2E against remote test
  resources, and prepare/check the dedicated E2E environment before building.
- Document the test-target allowlist, operator authorization, and local E2E safety
  procedure in English and Chinese.
- Fail closed before constructing remote clients unless reset targets exactly match
  the allowlisted Supabase test project and R2 test bucket.
- Apply URL-normalized same-origin `next` validation to both login and email-confirm
  redirects, with regression coverage for unsafe and malformed destinations.
- Add static CI workflow checks for trigger, secret, environment, and step-order
  boundaries; these checks do not run remote E2E or reset resources.

## [0.1.0] - 2026-09-28

First runnable release: a learning platform that stores PDFs in Cloudflare R2 and
serves them to signed-in students.

### Added

- Email + password authentication with invite-code-gated registration. The invite
  code is consumed atomically in Postgres before sign-up and refunded if sign-up
  fails. Confirmation link handling lives at `/auth/confirm`.
- Roles: `profiles.role ∈ {admin, student}`, defaulted to `student` by a database
  trigger. Admins manage documents and invite codes; students get read-only access.
- Document upload as a three-step flow: presigned `PUT` to R2 (XHR with a progress
  bar), then `POST /api/documents`, where the server verifies existence, byte size
  and content type with `HeadObject` before writing the row.
- Document list with filename search and an in-browser PDF reader
  (`<iframe>` + a refresh button for expired presigned URLs).
- Document deletion: R2 object first, then the database row, with the orphan case
  reported explicitly.
- Invite-code administration: list, create, change max uses, disable.
- `supabase/migrations/0001_init.sql` — schema, RLS policies, trigger, RPCs, grants.
- Vitest unit and route-handler tests, Playwright journey, GitHub Actions CI
  (typecheck, lint, test, build; e2e is manual-dispatch only because it wipes
  remote test data).
- `README.md` / `README.zh-CN.md`, MIT `LICENSE`.

### Known limitations

- The reader relies on the browser's built-in PDF viewer; Safari and mobile are
  untested.
- No server-side PDF magic-byte check: presigned URLs bind `ContentType`, which is
  client-declared. Mitigated by the 50 MB cap and admin-only deletion.
- `documents` is unpaginated and capped at 200 rows per query.

[Unreleased]: https://github.com/Bingo888-Lab/onlinelearninglab-vercel/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Bingo888-Lab/onlinelearninglab-vercel/releases/tag/v0.1.1
[0.1.0]: https://github.com/Bingo888-Lab/onlinelearninglab-vercel/releases/tag/v0.1.0
