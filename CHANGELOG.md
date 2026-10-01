# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-10-01

### Fixed

- Make the existing client actions recover from offline/failed responses with busy
  guards, safe errors, and success-only side effects; preserve the reader's previous
  URL on refresh failure. Distinguish page query errors from empty results and 404s.
- Return stable API error codes for query failures and cross-system partial failures;
  avoid logging SDK details, secrets, or signed URLs. Do not blindly delete an R2
  object when document metadata may have been written, and report uncertain delete
  outcomes for manual reconciliation. GET/PUT signing-failure logs include only stable
  operation/code/id fields; API JSON error contracts are unchanged.
- Reject PUT signing for an already-registered document ID with
  `409 document_exists`; return `502 query_failed` when the pre-check fails.

### Changed

- Trim invite codes consistently for creation and registration without changing case.
- Keep email validation at `email` plus 254 characters; do not trim, and reject
  leading/trailing whitespace.
- Enforce an application password contract with the existing `string.length >= 8`
  rule and at most 72 UTF-8 bytes. Upstream Supabase Auth source declares a 72-byte limit,
  but the hosted instance version is unverified; this does not guarantee that
  truncation risk is eliminated.
- Clamp the configured client upload limit to the 50 MiB hard cap.
- Preserve SQL LIKE search wildcards: `%` matches zero or more characters and `_`
  matches one character.
- Add offline Vitest coverage around existing component action boundaries without
  adding a test platform or dependencies.

### Known limitations

- Existing-ID pre-check only reduces overwrite risk. It cannot revoke an already
  signed URL or eliminate TOCTOU and replay risks.
- If metadata persistence is uncertain, the R2 object is not blindly deleted and the
  client must not directly re-upload; manual reconciliation is required.
- R2 deletion may succeed while the database delete fails or remains unconfirmed.
  The legacy `orphan` response field is retained for compatibility; this is not an
  atomic cross-system delete and requires manual reconciliation.
- Invite consumption and refund still use the existing atomic-count RPCs. Unknown,
  retryable, or transport outcomes do not trigger a blind refund. `X-Request-ID` is
  temporary request correlation only, not persisted recovery state; use a secure
  support channel and registration details for manual investigation. A process
  interruption may leave no log, and a lost refund response must not be blindly
  refunded again.
- Local gates passed on 2026-10-01: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
  `pnpm build` all exited 0; Vitest reported 32 files and 219 tests. Next 16.3.6 build
  used `.env.local` and printed the route table. No remote reset, real E2E, production
  operation, push, GitHub Release, or deploy was performed; local gate results are not
  remote E2E evidence or a claim that a release was published.

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

[Unreleased]: https://github.com/Bingo888-Lab/onlinelearninglab-vercel/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/Bingo888-Lab/onlinelearninglab-vercel/releases/tag/v0.1.2
[0.1.1]: https://github.com/Bingo888-Lab/onlinelearninglab-vercel/releases/tag/v0.1.1
[0.1.0]: https://github.com/Bingo888-Lab/onlinelearninglab-vercel/releases/tag/v0.1.0
