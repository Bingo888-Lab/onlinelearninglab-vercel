import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// proxy.ts 直接从 @supabase/ssr 导入，不经 @/lib/supabase/server —— mock 错模块
// 会让测试走真实客户端，getClaims() 返回空而误判成"未登录"。
const getClaims = vi.fn(async () => ({ data: { claims: null }, error: null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims } })),
}));

async function load() {
  vi.resetModules();
  return await import("@/lib/supabase/proxy");
}

function req(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: { cookie: "sb-access-token=x" },
  });
}

function signedIn() {
  getClaims.mockResolvedValue({
    data: { claims: { sub: "u1", role: "authenticated" } },
    error: null,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: { claims: null }, error: null } as never);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

describe("updateSession", () => {
  it("已登录时放行原请求（不重定向）", async () => {
    signedIn();
    const { updateSession } = await load();
    const res = await updateSession(req("/"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("未登录访问受保护路径 → 重定向到 /login 并带 next 参数", async () => {
    const { updateSession } = await load();
    const res = await updateSession(req("/documents/abc"));
    const location = new URL(res.headers.get("location")!, "http://localhost:3000");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/documents/abc");
  });

  it("未登录访问 /login 本身不重定向（避免循环）", async () => {
    const { updateSession } = await load();
    const res = await updateSession(req("/login"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("未登录访问 /register 不重定向", async () => {
    const { updateSession } = await load();
    const res = await updateSession(req("/register"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("未登录访问 API 路径不重定向，交由路由自己返回 401", async () => {
    const { updateSession } = await load();
    const res = await updateSession(req("/api/documents"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
