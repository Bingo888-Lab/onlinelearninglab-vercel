# OnlineLearningLab

开源云端学习平台：管理员上传 PDF 到 Cloudflare R2，学员在线阅读。Next.js + Supabase + Vercel。

[English](README.md)

## 架构

```
浏览器                        Vercel (Next.js)                 Supabase        Cloudflare R2
   |                                |                              |                 |
   |-- POST /api/documents/:id/upload-url (admin) ----------------->|                 |
   |                                |-- 签发 PUT 签名 (5 分钟) ------|---------------->|
   |<-- 预签名 PUT URL --------------------------------------------|                 |
   |                                |                              |                 |
   |-- XHR PUT 字节 (Content-Type: application/pdf) -------------------------------->|
   |                                |                              |                 |
   |-- POST /api/documents (HeadObject 核验) ----------->|            |                 |
   |                                |--------------> HeadObject ---->|                 |
   |                                |                              |                 |
   |-- GET /api/documents/:id/file (已登录) ------------->|            |                 |
   |<-- 预签名 GET URL ----------------------------------------------|--------------->|
   |-- <iframe src=预签名地址> --------------------------------------->|--------------->|
```

文件字节永远不经过 Vercel 函数：所有套餐的请求体上限都是 4.5 MB，50 MB 的 PDF
没法走服务端上传。应用只负责签发 URL。

## 前置条件

- Node.js >= 20.9（开发时用 26.x）
- pnpm
- 一个 Supabase 项目（Auth + Postgres）
- 一个 Cloudflare R2 私有桶，并配好 CORS
- 一个 Vercel 账号（Hobby 套餐即可）

## 部署步骤

### 1. 安装

```bash
pnpm install
```

### 2. 环境变量

```bash
cp .env.example .env.local
# 填入真实值，然后：
pnpm env:check   # 只校验是否存在，绝不打印值
```

| 变量 | 含义 | 去哪取 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 项目 URL | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable / anon key | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | 绕过 RLS。仅服务端与 `scripts/` 使用 | Supabase → Project Settings → API Keys |
| `R2_ACCOUNT_ID` | Cloudflare 账户 ID | Cloudflare 控制台右侧栏 |
| `R2_BUCKET` | 私有桶名 | Cloudflare → R2 → buckets |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Object Read & Write token，限定单个桶 | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_SIGN_TTL_SECONDS` | 预签名 URL 有效期（默认 300 秒） | 自定 |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | 单文件上限（默认 50 MB） | 自定 |

service role key 绝不能加 `NEXT_PUBLIC_` 前缀。`.env.local` 已被 `.gitignore` 忽略。

### 3. 执行数据库迁移

两种方式都可以：

**Dashboard（不需要 CLI）**

1. Supabase → SQL Editor → New query
2. 粘贴 `supabase/migrations/0001_init.sql` 的全部内容
3. 点 Run

**CLI**

```bash
pnpm dlx supabase@latest db push --db-url "postgresql://postgres:PASSWORD@HOST:5432/postgres"
```

该迁移会建出 `profiles`、`documents`、`invite_codes` 三张表、RLS 策略、
`handle_new_user` trigger，以及 `consume_invite_code` / `refund_invite_code` 两个 RPC。
**不是幂等的**，每个项目只跑一次。

### 4. R2 桶的 CORS

没有这条规则，浏览器直传会报一个很难懂的 CORS 错误。
Cloudflare → R2 → 你的桶 → Settings → CORS policy：

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

如果绑了自定义域名，把 `https://*.vercel.app` 换成真实域名。桶保持**私有**，
访问只走预签名 URL。

### 5. 第一个管理员账号

管理员密码不进 git、不进 env 文件、不进命令行。先在 Dashboard 建号，再提权：

1. Supabase → Authentication → Users → **Add user**
2. 填邮箱与密码，勾选 **Auto Confirm User**，保存
3. 本地执行：

```bash
pnpm admin:grant --email you@example.com
```

之后用该账号登录即可进入 `/admin`。

### 6. 跑起来

```bash
pnpm dev            # http://localhost:3000
```

## 常用命令

| 命令 | 预期输出 |
| --- | --- |
| `pnpm typecheck` | exit 0，无输出 |
| `pnpm lint` | exit 0 |
| `pnpm test` | 全部 passed |
| `pnpm build` | 输出路由表，无 error |
| `pnpm env:check` | `环境变量检查通过` |
| `pnpm e2e` | Playwright 关键路径通过 |

## 部署到 Vercel

1. 在 [vercel.com/new](https://vercel.com/new) 导入本仓库（公开仓库，Hobby 套餐）。
2. 把上面表格里的变量全部加到 **Production**，指向**生产** Supabase 项目与
   **生产** R2 桶，不要用测试那套。
3. 部署完成后，打开 Supabase → Authentication → URL Configuration，
   把生产域名加进 **Redirect URLs**，否则邮件确认链接跳不回来。
4. 对生产项目重复第 5 步，创建第一个管理员。

## 项目状态

v0.1.0 已实现：

- 邀请码注册、邮箱确认、登录 / 登出
- 管理员：上传 PDF（直传 R2 带进度条）、删除文档、管理邀请码
- 学员：只读文档列表 + 文件名搜索、浏览器内 PDF 阅读
- 应用层角色校验，RLS 作为第二道防线

v0.1.0 明确不做：PDF 解析与封面、阅读进度、课程结构、全文搜索、病毒扫描、用户管理。

已知限制：阅读器是原生 `<iframe>`，渲染依赖浏览器自带 PDF 阅读器
（桌面 Chrome/Edge/Firefox 正常，Safari 与移动端未实测）。

## 许可

[MIT](LICENSE)
