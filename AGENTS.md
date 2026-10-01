<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OnlineLearningLab — agent entry point

Open-source cloud learning platform. Admins upload PDFs to Cloudflare R2; students
read them online. Next.js 16 (App Router) + Supabase (Auth + Postgres) + Vercel.

Read this before writing code. The notes below are the ones that cost time.

## Commands

| Command | What it does | Expected |
| --- | --- | --- |
| `pnpm dev` | dev server on :3000 | — |
| `pnpm typecheck` | `tsc --noEmit` | exit 0, no output |
| `pnpm lint` | ESLint 9 flat config (`next lint` no longer exists) | exit 0 |
| `pnpm test` | Vitest, `src/**/*.test.ts` + `scripts/**/*.test.mjs` | all passed |
| `pnpm build` | production build | route table, no errors |
| `pnpm env:check` | validates `.env.local` presence, never prints values | `环境变量检查通过` |
| `pnpm e2e` | Playwright; wipes remote **test** Supabase + R2 first | journey passes |
| `pnpm e2e:fixture` | regenerate `e2e/fixtures/test.pdf` | `Generated ...` |
| `pnpm admin:grant --email you@example.com` | set `profiles.role = 'admin'` | `已把 ... 设为 admin` |

Gate: typecheck, lint, test, build all green before committing.

## Environment

Full table lives in `README.md` / `README.zh-CN.md`. `.env.local` is gitignored and
holds the test Supabase (`xleewqxbjfetctmsjquk`) and test R2 bucket
(`online-learning-lab-test`). Production values are injected by Vercel only — never
put them in `.env.local`.

The local production snapshot lives in **`.env.prod.local`**, and that name is
load-bearing: Next 16 auto-loads `.env.production.local` in production mode with
higher precedence than `.env.local`. Naming it `.env.production.local` makes
`pnpm build` inline the **production** Supabase URL into the client bundle and makes
`pnpm start` / `pnpm e2e` talk to the production database and bucket. Read the
snapshot explicitly instead:

```bash
vercel env pull .env.prod.local --environment=production
pnpm admin:grant --email you@example.com --env-file .env.prod.local
```

Vercel marks the R2/Supabase variables `sensitive`, so their values cannot be read
back through the API or CLI — keep `.env.prod.local` (and the ignored
`.env-backup-*/`) on disk if you need them.

## Layout

```
src/
  proxy.ts                     # Next 16 middleware (NOT middleware.ts)
  lib/
    auth.ts                    # requireUser / requireAdmin, role from profiles
    validation.ts              # zod request bodies
    r2.ts r2-keys.ts           # S3Client + presign/head/delete, key whitelist
    supabase/{server,client,admin,proxy}.ts
  app/
    page.tsx                   # document list (login required)
    login/ register/ auth/confirm/
    documents/[id]/            # reader page + ReaderFrame
    admin/                     # upload form, delete button, invite forms
    api/{documents,invites,register}/...
supabase/migrations/0001_init.sql
scripts/{check-env,admin-grant,reset-e2e,make-fixture-pdf}.mjs
e2e/journey.spec.ts
```

## API

| Route | Auth | Notes |
| --- | --- | --- |
| `POST /api/documents` | admin | HeadObject verify, then insert |
| `GET /api/documents` | login | `?q=` filename search, limit 200 |
| `POST /api/documents/[id]/upload-url` | admin | path id must equal body id |
| `GET /api/documents/[id]/file` | login | returns presigned GET; URL never logged |
| `DELETE /api/documents/[id]` | admin | R2 first, then row |
| `GET/POST /api/invites` | admin | service_role client |
| `PATCH/DELETE /api/invites/[code]` | admin | DELETE = deactivate, not drop |
| `POST /api/register` | public | consume code → `auth.signUp` → refund on failure |
| `GET /auth/confirm` | public | `verifyOtp`, safe `next` redirect |

Errors are `{"error":"<code>"}`. Codes: `unauthorized` 401, `forbidden` 403,
`not_found` 404, `invalid_input` / `invite_invalid` 400, `*_failed` 502.

## Non-negotiables

- **Presigned PUT binds `Content-Type: application/pdf`.** The browser PUT must send
  the identical header or R2 answers `SignatureDoesNotMatch`. Do not "fix" the client
  to send the real file type.
- **Bytes never go through a Vercel function** (4.5 MB body cap). Only URLs do.
- **Admin passwords never enter git, env files, or the command line.** Create the
  account in the Dashboard, then `pnpm admin:grant`.
- **Invite failures return one identical response.** Distinguishing "missing" from
  "exhausted" builds an invite-code existence oracle.
- **Presigned URLs are credentials.** They appear only in a 200 body, never in logs,
  error bodies, or thrown errors.
- **Roles come from the `profiles` table, not JWT claims**, so RLS can check them.

## Version traps in this stack

- Next 16 renamed `middleware.ts` → `proxy.ts` with `export async function proxy`.
  `params` / `searchParams` are Promises and must be awaited.
- Supabase SSR: call `supabase.auth.getClaims()` and put **nothing** between
  `createServerClient()` and that call, or sessions drop at random.
- `supabase.auth.admin.createUser({ email_confirm: false })` does not send a
  confirmation email. Registration therefore uses the public `auth.signUp`; only the
  service-role client is reserved for `invite_codes`.
- RLS policies do not grant table privileges. `0001_init.sql` issues explicit
  `GRANT` / `REVOKE` statements — keep them in sync with new tables.
- In Server Components `cookies().set()` throws; `createServerSupabaseClient` swallows
  it on purpose and session refresh is left to `src/proxy.ts`.

## Platform quirks (Windows, this machine)

- Native tools need `C:/...` forward-slash paths; MSYS path translation is off.
- The terminal guard refuses commands whose text contains a dev-server token. Rephrase
  (variable expansion) or move the command into a script.
- Playwright `webServer.command` must not use `VAR=value cmd` prefixes — Windows cmd
  does not accept them. Pass opt-in flags through `webServer.env`.
- Reset scripts run as a `&&` prefix inside `webServer.command`, never in
  `globalSetup`: webServers start first, and a live file handle makes the wipe fail
  EPERM on Windows.
- An interrupted `pnpm build` can leave a Turbopack **junction** under
  `.next/node_modules/`. The next build then dies with
  `EPERM: operation not permitted, unlink '.next/node_modules/...'`, because the
  cleanup unlinks a directory junction. Break the junction with `fs.rmdirSync`
  (never `unlink`/`rmSync` for it), delete `.next`, rebuild. `node_modules` itself is
  untouched.

## `data-testid` contract (e2e depends on these)

`login-form`, `email`, `password`, `login-submit`, `login-error`, `logout`,
`register-form`, `invite-code`, `register-submit`, `register-done`, `register-error`,
`search`, `doc-list`, `doc-item`, `empty`, `pdf-frame`, `refresh-link`, `sign-failed`,
`nav-admin`, `upload-form`, `file-input`, `upload-progress`, `upload-submit`,
`upload-error`, `admin-doc-list`, `admin-doc-item`, `admin-empty`, `delete-doc`,
`delete-confirm`, `invite-form`, `invite-code-input`, `invite-maxuses`,
`invite-submit`, `invite-list`, `invite-item`, `invite-disable`, `invite-error`.
