# OnlineLearningLab

Open-source cloud learning platform: admins upload PDFs to Cloudflare R2, students
read them online. Next.js + Supabase + Vercel.

[简体中文](README.zh-CN.md)

## Architecture

```
Browser                      Vercel (Next.js)                 Supabase        Cloudflare R2
   |                                |                              |                 |
   |-- POST /api/documents/:id/upload-url (admin) ----------------->|                 |
   |                                |-- sign PUT (5 min) ---------|---------------->|
   |<-- presigned PUT URL -----------------------------------------|                 |
   |                                |                              |                 |
   |-- XHR PUT bytes (Content-Type: application/pdf) -------------------------------->|
   |                                |                              |                 |
   |-- POST /api/documents (HeadObject verify) ----->|              |                 |
   |                                |----------------> HeadObject ->|                 |
   |                                |                              |                 |
   |-- GET /api/documents/:id/file (login) ----------->|              |                 |
   |<-- presigned GET URL --------------------------------------------|--------------->|
   |-- <iframe src=presigned> --------------------------------------->|--------------->|
```

File bytes never touch a Vercel function: the 4.5 MB request-body cap on every Vercel
plan makes server-side upload impossible for 50 MB PDFs. The app only signs URLs.

## Prerequisites

- Node.js >= 20.9 (developed on 26.x)
- pnpm
- A Supabase project (Auth + Postgres)
- A Cloudflare R2 bucket (private) with a CORS rule
- A Vercel account (Hobby is enough)

## Setup

### 1. Install

```bash
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
# fill in the values, then:
pnpm env:check   # validates presence only, never prints values
```

| Variable | Meaning | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. Server + `scripts/` only | Supabase → Project Settings → API Keys |
| `R2_ACCOUNT_ID` | Cloudflare account id | Cloudflare dashboard sidebar |
| `R2_BUCKET` | Private bucket name | Cloudflare → R2 → buckets |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Object Read & Write token, scoped to one bucket | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_SIGN_TTL_SECONDS` | Presigned URL lifetime (default 300) | your choice |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | Per-file upload cap (default 50) | your choice |

Never prefix the service role key with `NEXT_PUBLIC_`. Never commit `.env.local`.

### 3. Database migration

Two options, both fine:

**Dashboard (no CLI needed)**

1. Supabase → SQL Editor → New query
2. Paste the whole content of `supabase/migrations/0001_init.sql`
3. Run

**CLI**

```bash
pnpm dlx supabase@latest db push --db-url "postgresql://postgres:PASSWORD@HOST:5432/postgres"
```

The migration creates `profiles`, `documents`, `invite_codes`, RLS policies, the
`handle_new_user` trigger, and the `consume_invite_code` / `refund_invite_code` RPCs.
It is not idempotent — run it once per project.

### 4. R2 bucket CORS

Without this rule the browser-direct upload fails with an opaque CORS error.
Cloudflare → R2 → your bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://*.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "ETag"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace `https://*.vercel.app` with your real domain if you bind one. Keep the bucket
**private** — access is only through presigned URLs.

### 5. First admin account

Admin passwords never enter git, env files, or the command line. Create the account in
the Supabase Dashboard, then grant the role:

1. Supabase → Authentication → Users → **Add user**
2. Enter email + password, tick **Auto Confirm User**, save
3. Locally:

```bash
pnpm admin:grant --email you@example.com
```

The new user can now sign in and reach `/admin`.

### 6. Run

```bash
pnpm dev            # http://localhost:3000
```

## Local commands

| Command | Expected output |
| --- | --- |
| `pnpm typecheck` | exit 0, no output |
| `pnpm lint` | exit 0 |
| `pnpm test` | all files passed |
| `pnpm build` | route table, no errors |
| `pnpm env:check` | `environment check passed` |
| `pnpm e2e` | Playwright journey passes |

## Deploying to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new) (public repo, Hobby plan).
2. Add every variable from the table above to **Production** — pointing at the
   *production* Supabase project and the *production* R2 bucket, not the test ones.
3. Deploy. Then open Supabase → Authentication → URL Configuration and add your
   production domain to **Redirect URLs** so email confirmations land back on the app.
4. Repeat step 5 (first admin) against the production project.

## Project status

Implemented in v0.1.0:

- invite-code registration, email confirmation, sign in / sign out
- admin: upload PDF (direct to R2 with progress), delete documents, manage invite codes
- student: read-only document list with filename search, in-browser PDF reader
- role enforcement in the app layer plus RLS as a second line of defense

Deliberately not in v0.1.0: PDF parsing/thumbnails, reading progress, course structure,
full-text search, virus scanning, user administration.

Known limitation: the reader is a native `<iframe>`, so PDF rendering depends on the
browser's built-in viewer (fine on desktop Chrome/Edge/Firefox, untested on Safari and
mobile).

## License

[MIT](LICENSE)
