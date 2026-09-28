import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAdmin }));

const patchSingle = vi.fn();
const patch = vi.fn(() => ({ select: () => ({ single: patchSingle }) }));
const update = vi.fn(() => ({ eq: () => ({ select: () => ({ single: patchSingle }) }) }));
const del = vi.fn();
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ single: vi.fn() }) }), update, delete: del }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from })),
}));

async function load() {
  vi.resetModules();
  return await import("./route");
}

const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/invites/WELCOME", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const params = () => ({ params: Promise.resolve({ code: "WELCOME" }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin" });
  patchSingle.mockResolvedValue({ data: { code: "WELCOME", is_active: false }, error: null });
});

describe("PATCH /api/invites/[code]", () => {
  it("admin 改次数 → 200", async () => {
    const { PATCH } = await load();
    const res = await PATCH(req("PATCH", { maxUses: 10 }), params());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ max_uses: 10 });
  });

  it("admin 禁用 → 200，写 is_active=false", async () => {
    const { PATCH } = await load();
    const res = await PATCH(req("PATCH", { isActive: false }), params());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ is_active: false });
  });

  it("student → 403", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 403, code: "forbidden" });
    const { PATCH } = await load();
    const res = await PATCH(req("PATCH", { maxUses: 10 }), params());
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("空 body → 400，不写库", async () => {
    const { PATCH } = await load();
    const res = await PATCH(req("PATCH", {}), params());
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("code 太短 → 400（防路径穿越）", async () => {
    const { PATCH } = await load();
    const res = await PATCH(req("PATCH", { maxUses: 10 }), {
      params: Promise.resolve({ code: "../etc" }),
    });
    expect(res.status).toBe(400);
  });

  it("更新失败 → 502", async () => {
    patchSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { PATCH } = await load();
    const res = await PATCH(req("PATCH", { maxUses: 10 }), params());
    expect(res.status).toBe(502);
  });
});

describe("DELETE /api/invites/[code] — 禁用而非删行", () => {
  it("admin → 200，置 is_active=false 保留审计痕迹", async () => {
    const { DELETE } = await load();
    const res = await DELETE(req("DELETE"), params());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ is_active: false });
    expect(del).not.toHaveBeenCalled();
  });

  it("未登录 → 401", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { DELETE } = await load();
    const res = await DELETE(req("DELETE"), params());
    expect(res.status).toBe(401);
  });

  it("code 非法 → 400", async () => {
    const { DELETE } = await load();
    const res = await DELETE(req("DELETE"), { params: Promise.resolve({ code: "x" }) });
    expect(res.status).toBe(400);
  });
});
