import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAdmin }));

const order = vi.fn();
const limit = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ order }));
const insertSingle = vi.fn();
const insert = vi.fn(() => ({ select: () => ({ single: insertSingle }) }));
const from = vi.fn(() => ({ select, insert }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

async function load() {
  vi.resetModules();
  return await import("./route");
}

function admin() {
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin" });
}
const body = (o: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/invites", { method: "POST", body: JSON.stringify(o) });

beforeEach(() => {
  vi.clearAllMocks();
  admin();
  order.mockReturnValue({ limit: (...a: unknown[]) => limit(...a) });
  limit.mockResolvedValue({ data: [{ code: "WELCOME", used_count: 0, max_uses: 5 }], error: null });
  insertSingle.mockResolvedValue({ data: { code: "WELCOME" }, error: null });
});

describe("GET /api/invites", () => {
  it("未登录 → 401", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/api/invites"));
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("student → 403", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 403, code: "forbidden" });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/api/invites"));
    expect(res.status).toBe(403);
  });

  it("admin → 200，倒序列出", async () => {
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/api/invites"));
    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith("invite_codes");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("查询失败 → 502", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/api/invites"));
    expect(res.status).toBe(502);
  });
});

describe("POST /api/invites", () => {
  it("admin 新建 → 201，写入 created_by", async () => {
    const { POST } = await load();
    const res = await POST(body({ code: "WELCOME", maxUses: 5 }));
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: "WELCOME", max_uses: 5, created_by: "admin-1" }),
    );
  });

  it("code 太短 → 400", async () => {
    const { POST } = await load();
    const res = await POST(body({ code: "ab", maxUses: 5 }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("maxUses 非正数 → 400", async () => {
    const { POST } = await load();
    const res = await POST(body({ code: "WELCOME", maxUses: 0 }));
    expect(res.status).toBe(400);
  });

  it("重复 code → 502 conflict（DB 唯一约束兜底）", async () => {
    insertSingle.mockResolvedValue({ data: null, error: { code: "23505" } });
    const { POST } = await load();
    const res = await POST(body({ code: "WELCOME", maxUses: 5 }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "insert_failed" });
  });

  it("未登录 → 401", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { POST } = await load();
    const res = await POST(body({ code: "WELCOME", maxUses: 5 }));
    expect(res.status).toBe(401);
  });
});
