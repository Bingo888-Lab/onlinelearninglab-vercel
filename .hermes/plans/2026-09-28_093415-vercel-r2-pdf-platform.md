# OnlineLearningLab-Vercel — v0.1.0 计划（Next.js + Supabase + Cloudflare R2）

> 经 5 轮对抗式拷问（`grill-me`）后的共识。文中每条决策都有明确答复来源，标注 `[已定]` 的不得在实现中擅自更改；标注 `[开放]` 的在实现时按建议处理并记入 CHANGELOG。

## Goal

在 Vercel 上部署一个开源云端学习平台 v0.1.0：管理员上传 PDF，文件字节存 Cloudflare R2 私有桶（浏览器直传），元数据与账号存 Supabase，登录学员在浏览器内在线阅读。

## Current context / assumptions

**工作区状态（已核实）**

- 目标目录 `C:\Users\bingo\项目\Coding\Project\OnlineLearningLab-Vercel` **完全为空**——无 `package.json`、无 `.git`、无 `.hermes/`。全新绿地项目。
- 同级目录存在已归档的 `Bingo888-Lab/OnlineLearningLab`（**archived**）：Hono + React + SQLite + Docker Compose 的自托管版，Hono/单测 57/e2e 3、CI action 全 SHA pin、data-testid 契约等约定值得继承，但技术栈与本项目**完全不同**。本项目是重写，不是迁移，不兼容旧 schema。
- 本机工具（已核实）：Node v26.7.0、pnpm 12.5.1、git 2.53.0、gh 已登录 `Bingo-888`、docker 29.8.0 可用。**`supabase` CLI 与 `vercel` CLI 未安装**（需 `pnpm dlx` 或 npx 调用，勿假定全局存在）；无 `psql`。
- `gh auth` 账户名 `Bingo-888` 与组织 `Bingo888-Lab` 不同，GitHub 仓库名必须全小写。

**平台硬约束（已查证，非推测）**

| 约束 | 值 | 影响 |
|---|---|---|
| Vercel 函数请求体上限 | **4.5 MB，所有套餐，不可配置** | 文件绝不能过函数。必须 R2 预签名 PUT 直传。`next.config` 任何设置都改不动它 |
| Vercel 部署账户 | Hobby（个人） | 仓库必须公开；每日构建次数受限 |
| R2 预签名 PUT | 签名绑定 `ContentType` | 客户端 PUT 时**必须**发完全一致的 `Content-Type: application/pdf`，否则 R2 返回 403 `SignatureDoesNotMatch` |
| R2 预签名 GET | 有效期由 `expiresIn` 决定 | 链接会过期，阅读器需提供刷新入口 |
| Next.js | 16.2.x stable，Turbopack 为默认 bundler | `middleware.ts` 已更名 `proxy.ts` + `export async function proxy`；`params`/`searchParams` 必须 `await`；`next lint` 已移除，改用 ESLint 9 直跑；需 Node ≥ 20.9 |
| Supabase SSR | `@supabase/ssr` 在 Next 16 下用 `supabase.auth.getClaims()` | 网上多数旧教程用 `getUser()`，照抄会掉登录态 |
| react-pdf / pdfjs-dist | **本版不使用** | 阅读器为原生 `<iframe>`，无 PDF.js 依赖 |

**已定决策清单（grill-me 5 轮全部收敛）**

| # | 决策 |
|---|---|
| 1 | 范围：v0.1.0 仅「上传 PDF + 列表页 + 在线阅读器」。无课程模型、无阅读进度、无测验 |
| 2 | 权限：admin 可上传/删除/管邀请码，student 只读 |
| 3 | 元数据 + auth：Supabase（Postgres + Auth） |
| 4 | 存储：R2 **私有桶**，服务端签发短时效预签名 URL |
| 5 | 脚手架：`create-next-app`（App Router + TS + Tailwind + src/ + `@/*` + pnpm） |
| 6 | 认证：邮箱+密码；`profiles.role ∈ {admin, student}`；注册需邀请码 |
| 7 | 上传上限 50 MB，XHR PUT + 进度条 |
| 8 | 信任边界：预签名固定 `ContentType=application/pdf`，客户端必须带该头；**不做**服务端魔数校验 |
| 9 | 测试：Vitest 单元 + Playwright 两条 e2e（上传→阅读、删除→404） |
| 10 | 开源：MIT LICENSE + README(英) + README.zh-CN.md + GitHub Actions CI 都在 v0.1.0 内 |
| 11 | 阅读器：原生 `<iframe src=预签名URL>`，**零 PDF 依赖**；带「刷新链接」按钮 |
| 12 | 入库：两步。PUT 完成后客户端 `POST /api/documents`，服务端 `HeadObject` 核验存在+大小+类型后入库 |
| 13 | Supabase 接入：`@supabase/ssr` + `proxy.ts`（Next 16 名）刷新会话，Server Component 直接读用户 |
| 14 | Schema：手写 `supabase/migrations/*.sql` 进 git |
| 15 | 列表页：倒序 + 文件名搜索（`ilike`），无分页 |
| 16 | R2 key：`documents/<uuid>.pdf`（原始文件名只存 DB） |
| 17 | 注册页单输入框；失败提示「邀请码无效或已过期」（不区分码不存在/已用尽） |
| 18 | 邀请码表 `invite_codes`，`code` 单列 unique 主键，含 `max_uses`/`used_count`/`expires_at`/`created_by`/`is_active` |
| 19 | 限次：先验码（Postgres RPC 原子 `UPDATE ... WHERE used_count < max_uses AND ...`）→ 成功才 `signUp` |
| 20 | 邀请码后台管理：**在 v0.1.0 做**（/admin 页列出/新建/禁用/改次数） |
| 21 | 默认 admin：部署人自己在 Supabase Dashboard 点「Add user」+ Auto Confirm，再跑 `pnpm admin:grant --email ...` 脚本提权。**密码永不进 git、不进 env 文件、不进命令行** |
| 22 | `profiles` 行由 DB trigger 在 `auth.users` insert 时自动创建 `role='student'` |
| 23 | 生产 Supabase 开 email confirm；测试项目关掉 |
| 24 | 仓库：全新 `OnlineLearningLab-Vercel`，单一 Next.js app，无 workspace |
| 25 | 部署：Vercel Hobby + 公开仓库 + Cloudflare R2 + Supabase |

## Architecture / proposed approach

浏览器向应用请求预签名 URL → 应用（Vercel Function，仅签名，几十毫秒，不碰字节）→ 浏览器 `XHR PUT` 直传 R2 → 浏览器 `POST /api/documents` → 应用 `HeadObject` 核验后写 Supabase `documents` 行。阅读时应用签发 5 分钟预签名 GET，`<iframe>` 直接加载 R2。所有元数据读写走 Supabase SSR 客户端，`proxy.ts` 负责会话刷新，`documents` 与 `invite_codes` 两张表用 RLS 兜底（应用层已校验权限，RLS 是第二道防线而非唯一防线）。

**明确不做（YAGNI）**：PDF 解析/页数/封面/文本提取、缩略图、阅读进度、课程章节模型、全文搜索、病毒扫描、对象去重、批量操作、审计日志、后台用户管理（改密码/角色）。

## 目录结构

```
src/
  proxy.ts                        # Next 16 会话刷新（不是 middleware.ts）
  lib/
    supabase/
      server.ts                   # createServerClient（cookie 读写）— RSC/Route Handler
      client.ts                   # createBrowserClient — 客户端组件
      proxy.ts                    # updateSession(request) — 供 proxy.ts 调用
    env.ts                        # 集中读取 + zod 校验环境变量
    r2.ts                         # S3Client（region auto + R2 endpoint）+ presignPut/presignGet/head/delete
    r2-keys.ts                    # buildObjectKey(uuid) 等纯函数
    auth.ts                       # getUser() / getProfile() / requireAdmin()
    validation.ts                 # zod schemas（与前端表单共用）
  app/
    layout.tsx  page.tsx          # 首页 = 文档列表（需登录）
    login/page.tsx  register/page.tsx
    documents/[id]/page.tsx       # 阅读器页
    admin/page.tsx                # 上传 + 邀请码管理
    api/
      documents/route.ts                     # GET 列表 / POST 入库（admin）
      documents/[id]/route.ts                # DELETE（admin）
      documents/[id]/file/route.ts           # GET 预签名 URL（登录）
      invites/route.ts                       # GET 列表 / POST 新建（admin）
      invites/[code]/route.ts                # PATCH 改次数/禁用 / DELETE（admin）
      register/route.ts                      # POST 验码+注册
supabase/migrations/0001_init.sql
e2e/journey.spec.ts  playwright.config.ts  fixtures/test.pdf
scripts/admin-grant.mjs           # 授予 admin
vitest.config.ts
```

## 步骤任务

每步遵循 TDD：先写测试 → 跑红 → 最小实现 → 跑绿 → commit。commit 用 conventional commits。

### 阶段 0 — 地基

**T0.1 脚手架 + git**

```bash
cd "C:/Users/bingo/项目/Coding/Project/OnlineLearningLab-Vercel"
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
git init && git add -A && git commit -m "chore: scaffold Next.js app with pnpm"
```

预期输出：`✓ Created ...` + `Initialized a git repository.`

注意：`create-next-app` 16.x 会生成 `AGENTS.md` 与 `CLAUDE.md`——本项目自己维护 `AGENTS.md` 作为代理入口，改写它而不是并存两份。

**T0.2 依赖**

```bash
pnpm add @supabase/supabase-js @supabase/ssr @aws-sdk/client-s3 @aws-sdk/s3-request-presigner zod
pnpm add -D vitest @playwright/test @types/node
pnpm exec playwright install chromium
```

预期：安装成功；`node_modules/.bin/vitest` 存在。

**T0.3 环境变量契约（先定，再写代码）**

创建 `.env.example`（进 git）与 `.env.local`（gitignore）：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
# Dashboard → Project Settings → API Keys 取（勿用 anon key 命名）
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx   # 仅 scripts/ 与 RLS 绕过处使用，绝不进客户端

# Cloudflare R2
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=online-learning-lab
R2_SIGN_TTL_SECONDS=300
NEXT_PUBLIC_MAX_UPLOAD_MB=50
```

同时写 `.gitignore` 追加项：`.env*`、`playwright-report/`、`test-results/`、`e2e/fixtures/*.pdf`。

**T0.4 CI 与文档骨架**

- `.github/workflows/ci.yml`：3 job —— `checks`（`pnpm install --frozen-lockfile` + `pnpm typecheck` + `pnpm test` + `pnpm build`）、`e2e`（装 Playwright + `pnpm build && pnpm exec playwright test`）、`lint`。**所有 `uses:` pin 到 40 位 commit SHA**（继承旧项目约定）。env 从 GitHub Secrets 读（`CI` job 另需 `CI=1`）。
- `LICENSE`（MIT，版权 `Bingo888-Lab`）、`README.md`、`README.zh-CN.md`（占位骨架，阶段 6 填内容）、`CHANGELOG.md`（`## [0.1.0] - <date>` 段占位）。
- commit。

### 阶段 1 — Supabase 接入

**T1.1 迁移文件**

`supabase/migrations/0001_init.sql`：

```sql
-- profiles：id 引用 auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'student' check (role in ('admin','student')),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  object_key text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index documents_created_at_idx on public.documents (created_at desc);

create table public.invite_codes (
  code text primary key,
  max_uses integer not null check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- trigger：新 auth user 自动建 student profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 邀请码原子消耗：并发安全
create or replace function public.consume_invite_code(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  update public.invite_codes
     set used_count = used_count + 1
   where code = p_code
     and is_active
     and used_count < max_uses
     and (expires_at is null or expires_at > now());
  get diagnostics v_ok = row_count > 0;
  return v_ok;
end $$;

-- RLS：应用层已校验权限，RLS 是第二道防线
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.invite_codes enable row level security;

-- 登录用户可读所有 documents；写入仅 admin
create policy "authenticated read documents" on public.documents
  for select to authenticated using (true);
create policy "admin insert documents" on public.documents
  for insert to authenticated
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role = 'admin'));
create policy "admin delete documents" on public.documents
  for delete to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'admin'));

-- invite_codes 与 profiles(除自己) 不对客户端开放：仅 service_role（经 API 路由）
create policy "own profile read" on public.profiles
  for select to authenticated using (id = auth.uid());

revoke all on function public.consume_invite_code(text) from public, anon, authenticated;
grant execute on function public.consume_invite_code(text) to service_role;
```

应用：用 `pnpm dlx supabase@latest db push --db-url "$DATABASE_URL"` 或 Dashboard SQL Editor 逐段执行（本机无 supabase CLI 与 psql，**两种都可，写进 README**）。

验证：

```bash
pnpm exec tsc --noEmit   # 预期：exit 0
```

commit `feat(db): add profiles/documents/invite_codes schema with RLS`。

**T1.2 Supabase 客户端三件套（TDD）**

先写 `src/lib/supabase/server.test.ts`（vitest）：断言 `createServerClient` 传入的 `NEXT_PUBLIC_SUPABASE_URL` 与 `cookies.getAll/setAll` 行为；断言 `updateSession` 在无用户且路径 `/` 时返回 302 到 `/login`，在 `/login` 时不重定向。这需要 mock `next/headers`，用 `vi.mock`。

实现 `src/lib/supabase/server.ts`、`client.ts`、`proxy.ts`（`updateSession`）与根目录 `src/proxy.ts`：

```ts
// src/proxy.ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

`updateSession` 内部**必须** `await supabase.auth.getClaims()`，且在 `createServerClient` 与 `getClaims()` 之间不写任何代码（Supabase 官方明示，否则会随机掉登录）。Node runtime 下 `getClaims()` 走网络，匹配器已排除静态资源。

验证：`pnpm test` 预期 `N passed`（记下实际数字，后续门禁用）。

commit。

### 阶段 2 — R2 封装

**T2.1 纯函数 + 单元测试（先红）**

`src/lib/r2-keys.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { buildObjectKey } from "./r2-keys";

describe("buildObjectKey", () => {
  it("返回 documents/<uuid>.pdf 形式，不含原始文件名", () => {
    const key = buildObjectKey("6b0f1a2c-1111-4222-8333-444444444444");
    expect(key).toBe("documents/6b0f1a2c-1111-4222-8333-444444444444.pdf");
  });
  it("不接受路径穿越字符", () => {
    expect(() => buildObjectKey("../secret")).toThrow();
  });
});
```

`src/lib/r2-keys.ts`：

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PDF_CONTENT_TYPE = "application/pdf";

export function buildObjectKey(id: string): string {
  if (!UUID_RE.test(id)) throw new Error("invalid document id");
  return `documents/${id}.pdf`;
}
```

跑：`pnpm test src/lib/r2-keys.test.ts` → 预期红（模块不存在）。实现后 → 绿。commit。

**T2.2 S3Client 封装（先红）**

`src/lib/r2.test.ts` — 关键 TDD 点：**不联网也能验证签发逻辑**。用 `vi.mock("@aws-sdk/s3-request-presigner")` 把 `getSignedUrl` 替换为 spy，断言：

1. `presignPut(key)` 传给 `PutObjectCommand` 的 `ContentType` 恰为 `"application/pdf"`；
2. `presignGet(key)` 传入 `expiresIn: 300`；
3. `presignPut` 拒绝非 `documents/*.pdf` 的 key。

`src/lib/r2.ts`：

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildObjectKey, PDF_CONTENT_TYPE } from "./r2-keys";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export function presignPut(key: string) {
  if (!/^documents\/[0-9a-f-]{36}\.pdf$/i.test(key)) throw new Error("invalid key");
  return getSignedUrl(r2, new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key, ContentType: PDF_CONTENT_TYPE,
  }), { expiresIn: 300 });
}

export const presignGet = (key: string) =>
  getSignedUrl(r2, new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    { expiresIn: Number(process.env.R2_SIGN_TTL_SECONDS ?? 300) });

export async function headObject(key: string) {
  return r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
}
export const deleteObject = (key: string) =>
  r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
```

跑测试 → 绿。commit。

### 阶段 3 — API 路由

统一错误体 `{"error":"<code>"}`；401 未登录、403 非 admin、404 不存在、400 校验失败、502 上游（R2/Supabase）异常。

**T3.1 `POST /api/documents`（入库核验）**

`src/app/api/documents/route.test.ts` — vitest，`vi.mock` 掉 `@/lib/auth` 与 `@/lib/r2` 与 `@/lib/supabase/server`：

| 用例 | 断言 |
|---|---|
| 未登录 | 401 |
| student | 403 |
| admin + headObject 抛 NotFound | 400 `object_missing` |
| admin + size 与上报不符 | 400 `size_mismatch`，且 **DB 无插入** |
| admin + ContentType 非 application/pdf | 400 `content_type_mismatch` |
| admin + 合法 | 201，返回 `documents` 行 |

```ts
// src/app/api/documents/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { headObject, presignPut } from "@/lib/r2";
import { buildObjectKey, PDF_CONTENT_TYPE } from "@/lib/r2-keys";

const Body = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();            // 401/403 自行抛出
  if (!admin.ok) return NextResponse.json({ error: admin.code }, { status: admin.status });
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const key = buildObjectKey(parsed.data.id);
  let head;
  try { head = await headObject(key); }
  catch { return NextResponse.json({ error: "object_missing" }, { status: 400 }); }
  if (head.ContentType !== PDF_CONTENT_TYPE)
    return NextResponse.json({ error: "content_type_mismatch" }, { status: 400 });
  if (head.ContentLength !== parsed.data.sizeBytes)
    return NextResponse.json({ error: "size_mismatch" }, { status: 400 });

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("documents").insert({
    id: parsed.data.id, title: parsed.data.title, object_key: key,
    size_bytes: parsed.data.sizeBytes, uploaded_by: admin.userId,
  }).select().single();
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 502 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: Request) {
  const user = await requireUser();              // 401
  if (!user.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const supabase = await createServerClient();
  let query = supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 502 });
  return NextResponse.json(data);
}
```

> 保留 5 分钟预签名 PUT 端点用于上传（见 T4.1）；这里 `presignPut` 的 import 在 GET 侧不必引入——实现时按需清理未用 import，`tsc --noEmit` 会因 `noUnusedLocals` 报错，这正是它的目的。

先红 → 实现 → `pnpm test` 绿 → commit。

**T3.2 `GET /api/documents/[id]/file`（预签名 GET）**

Next 16 的 `params` 是 Promise：`const { id } = await params;`。测试：student 可取（200，含 `url` 与 `expiresAt`）、未登录 401、uuid 非法 400、DB 无此行 404、**`url` 不得出现在日志或错误体里**（签名是凭据）。

**T3.3 `DELETE /api/documents/[id]`**

顺序：先查 DB 拿 `object_key` → `deleteObject(key)` → 删 DB 行。DB 删除失败要说明 R2 已删（`{"error":"db_delete_failed","orphan":true}`，日志告警）。测试覆盖三种角色与 R2 抛错分支。

**T3.4 邀请码 API**

`GET/POST /api/invites`、`PATCH/DELETE /api/invites/[code]`。**必须用 service_role 客户端**（`src/lib/supabase/admin.ts`，用 `SUPABASE_SERVICE_ROLE_KEY`，`auth: { persistSession:false }`），因为 `invite_codes` 的 RLS 不对 authenticated 开放。DELETE 语义定为「禁用」而非删行（`is_active=false`）——保留审计痕迹。测试覆盖 role 守卫与 `consume_invite_code` RPC 调用。

**T3.5 `POST /api/register`（验码 + 注册）**

```ts
const Body = z.object({ email: z.string().email(), password: z.string().min(8).max(72), inviteCode: z.string().min(4).max(40) });
```

流程：service_role 调 `consume_invite_code(code)` → false 则 400 `invite_invalid`（**不区分原因**）→ true 则 `admin.auth.admin.createUser({ email, password, email_confirm: false })`（生产需确认）→ 失败时把 `used_count` 减回去（RPC `refund_invite_code`）→ 成功 201 `{ needsEmailConfirmation: true }`。

测试：码无效→400 且未调 createUser；码有效→201；createUser 失败→used_count 复原。commit。

### 阶段 4 — 页面

**T4.1 登录/注册页**（`src/app/login/page.tsx`、`register/page.tsx`）。客户端组件调 `@/lib/supabase/client`。注册表单三个字段（含邀请码），错误文案统一「邀请码无效或已过期」。

**T4.2 首页 = 文档列表**。Server Component 直接 `createServerClient()` 读表（决策 13），搜索框是 GET 表单 `?q=`，无需 client 状态。空态文案「还没有资料，上传第一份 PDF 吧」。

**T4.3 `/admin` 上传页**。上传三步：① `POST /api/documents/[id]/upload-url` 取预签名 PUT（返回 `url` + `objectKey`）→ ② `XHR` PUT，`xhr.setRequestHeader("Content-Type","application/pdf")`（**必须**，否则 R2 403）+ `onprogress` 进度条 → ③ `POST /api/documents` 入库 → 成功则 `router.refresh()`。前端先按 `file.size > 50MB` 拦截（`NEXT_PUBLIC_MAX_UPLOAD_MB`）。

**T4.4 `/admin` 邀请码管理**。列出 code/已用/上限/过期/状态，新建表单，禁用与改次数按钮。每次操作后 `router.refresh()`。

**T4.5 `/documents/[id]` 阅读器页**

```tsx
// Server Component 取签名 URL
const supabase = await createServerClient();
const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
if (!doc) notFound();
```

客户端 `ReaderFrame` 组件持有 `url` state，`<iframe src={url} className="h-[calc(100vh-4rem)] w-full" title={doc.title} />` + 「链接已过期？刷新」按钮 → `fetch('/api/documents/'+id+'/file')` 换新 URL。预签名 5 分钟，iframe 一旦加载完浏览器已缓存整个文件，续读不中断；只有打开新页才可能撞过期，此时点按钮即可。

**T4.6 授权守卫**。`src/lib/auth.ts`：

```ts
export async function requireUser() { /* 无 claims → { ok:false, status:401, code:"unauthorized" } */ }
export async function requireAdmin() { /* 无 claims → 401；role!=="admin" → { ok:false, status:403, code:"forbidden" } */ }
```

首页与阅读器页在 layout 层做登录重定向（`proxy.ts` 已处理 API 与页面的会话刷新，重定向放在页面内更可控）。commit。

### 阶段 5 — 测试

**T5.1 Vitest 全绿**：`pnpm test` → 预期 `r2-keys 2 + r2 3 + documents route 6 + file route 4 + delete 4 + invites 6 + register 3 = 28 passed`（实际数字以实现为准，记入 README 门禁）。

**T5.2 Playwright**

`e2e/fixtures/test.pdf` 用 `scripts/make-fixture-pdf.mjs` 生成——手写最小合法 PDF（无依赖，30 行，含 2 页 `%PDF-1.4` 文本）。`playwright.config.ts`：`webServer: { command: "pnpm dev", port: 3000, reuseExistingServer: !process.env.CI }`，`env` 里注入测试 Supabase/R2 凭据。

两条 e2e（沿用旧项目 data-testid 约定，不改名）：

1. `e2e/journey.spec.ts` — **上传→阅读**：以 admin 登录（测试 Supabase 预置 admin）→ `/admin` 选 fixture PDF → 等 `upload-progress` 到达 100 → 列表出现该标题 → 点进 `/documents/[id]` → `pdf-frame` 的 src 匹配 `r2.cloudflarestorage.com`。
2. **删除→404**：同一文档 admin 删除 → 列表消失 → 直接访问其 `/documents/[id]` → 显示 not-found。

前置：e2e 前用 `scripts/reset-e2e.mjs` 清测试 Supabase 表（`TRUNCATE documents, invite_codes, profiles CASCADE`）+ 清测试 R2 桶。**该脚本必须在 webServer 启动命令前跑**（旧项目坑 #5：放 globalSetup 里在 Windows 必然 EPERM）。

```bash
node scripts/reset-e2e.mjs && node scripts/make-fixture-pdf.mjs && pnpm exec playwright test
# 预期：2 passed
```

commit。

### 阶段 6 — 文档与发布

- `README.md`（英）：一句话简介、架构 ASCII 图、**环境变量全表**（名称/含义/在哪取）、Supabase 迁移两种执行方式、R2 桶 CORS 配置（见风险 R3）、默认 admin 授予三步、部署到 Vercel、本地开发命令、`pnpm test` 门禁数字、Project status 标注 v0.1.0 已实现/未实现。
- `README.zh-CN.md`：同结构中文版。
- `CHANGELOG.md`：`## [0.1.0] - 2026-09-28` 列出上述范围。
- `AGENTS.md`：项目入口文档（技术栈表、目录结构、API 速查、命令与预期输出、已知坑、data-testid 契约）。**每个阶段结束时同步更新**。
- 部署：`vercel` 部署，挂载生产 Supabase + 生产 R2 凭据，跑一遍 e2e 关键路径（注册→登录→上传→阅读→删除）。
- `git tag -a v0.1.0` → push → GitHub 建 Release。

## 测试 / 验证总门禁（Definition of Done）

```bash
pnpm typecheck        # 预期：exit 0，无输出
pnpm test             # 预期：全部 passed（数量记入 README）
pnpm lint             # 预期：exit 0
pnpm build            # 预期：Compiled successfully，无 error
node scripts/reset-e2e.mjs && pnpm exec playwright test   # 预期：2 passed
```

任一不绿不得 commit。每个任务内 TDD 循环：红 → 最小实现 → 绿 → commit。

## Risks, tradeoffs, and open questions

**R1 — 预签名 GET 5 分钟过期，iframe 长阅读中断？** 浏览器在 iframe 首次加载时已把整个 PDF 拉完并缓存，续读不受影响；只有**新开页面**可能撞过期，刷新按钮兜住。选 5 分钟而非 24 小时：签名 URL 是凭据，短时效泄露危害有限。真出问题时升级为同源代理路由（流量过函数，Vercel 有执行时长与流量成本）。

**R2 — 邀请码 `consume_invite_code` 计数与 `signUp` 非事务（R1 级）**：用户填了有效码但 signUp 失败会白扣一次。已用 `refund_invite_code` RPC 补偿。彻底解决需 Supabase 侧函数做同一事务，超出 v0.1.0 范围。

**R3 — R2 桶 CORS 配错 = 直传 403，且报错信息晦涩**：必须在 Cloudflare Dashboard 给桶加 CORS 规则，允许站点 origin、`PUT` 方法、`Content-Type` 请求头。README 给出完整 JSON 片段；T4.3 手工验证一次。

**R4 — 不做服务端魔数校验（决策 8）**：预签名绑定 `ContentType=application/pdf`，但 Content-Type 是客户端声明的，恶意用户可 PUT 任意字节并声明为 PDF。后果限于：占用存储、iframe 打不开。缓解：50 MB 上限 + 每份文档只 admin 可删。若 v0.1.x 出现该滥用，加 `HeadObject` 后拉前 1KB 校验 `%PDF-`（多一次 R2 读取）。

**R5 — `iframe` 原生阅读器在 Safari / 移动端可能不渲染 PDF**：Chrome/Edge/Firefox 桌面正常。降级方案（已记录，未做）：换 `@react-pdf-kit/viewer` 或 `react-pdf`。**这是 v0.1.0 最大的已知功能风险**，上线后需实测 Safari。

**R6 — Vercel Hobby 每日构建上限**：CI 每次 push 触发 3 个 job。控制方式：CI 只在 push/PR 到 main 触发，依赖用 `--frozen-lockfile` 命中缓存。若频繁触发触发额度，合并为 1 个 job。

**R7 — 生产开 email confirm，注册后用户需查邮箱**：`/api/register` 返回 `{ needsEmailConfirmation: true }`，注册页显示「请查收确认邮件」。测试 Supabase 关掉该开关，e2e 才能跑通。

**R8 — `documents` 表无分页，列表 limit 200**：[开放] 超过 200 份后旧文档搜不到。超过量级后加游标分页。

**R9 — 预签名 PUT 端点是新增的 API 面**：[开放] v0.1.0 用固定 5 分钟 TTL 的 PUT URL 端点（`POST /api/documents/[id]/upload-url`，仅 admin）；若将来需更细的配额控制，再引入 `handleUpload` 式 token 交换。

## 开放问题（实现前需确认，不阻塞 T0–T4）

1. R2 桶名最终定 `online-learning-lab` 还是别的？
2. 域名：走 Vercel 默认 `*.vercel.app` 还是绑自定义域？（影响 README 里的 CORS origin 片段）
3. e2e 用的测试 Supabase 项目与测试 R2 桶建好了吗？GitHub Secrets 名称清单需在 T0.4 定稿。
