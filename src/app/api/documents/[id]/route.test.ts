import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAdmin }));

const deleteObject = vi.fn(async () => undefined);
vi.mock("@/lib/r2", () => ({ deleteObject, headObject: vi.fn(), presignGet: vi.fn(), presignPut: vi.fn() }));

const single = vi.fn();
const eqDelete = vi.fn(() => Promise.resolve({ data: null, error: null }));
const eqSelect = vi.fn(() => ({ single }));
const from = vi.fn(() => {
  // 真实链路：from().select().eq().single() 与 from().delete().eq()
  const builder: Record<string, unknown> = {
    select: () => ({ eq: eqSelect }),
    delete: () => ({ eq: eqDelete }),
  };
  return builder;
});
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ from })),
}));

async function load() {
  vi.resetModules();
  return await import("./route");
}

const ID = "6b0f1a2c-1111-4222-8333-444444444444";
const KEY = `documents/${ID}.pdf`;
const params = () => ({ params: Promise.resolve({ id: ID }) });

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks 只清调用记录，不重置实现 —— 必须显式重建 happy path，
  // 否则上一个用例的 mockRejectedValue 会泄漏到下一个。
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin" });
  deleteObject.mockResolvedValue(undefined);
  single.mockResolvedValue({ data: { id: ID, object_key: KEY }, error: null });
  eqDelete.mockResolvedValue({ data: null, error: null });
});

describe("DELETE /api/documents/[id]", () => {
  it("admin → 200，先删 R2 再删 DB", async () => {
    const order: string[] = [];
    deleteObject.mockImplementation(async () => { order.push("r2"); });
    eqDelete.mockImplementation(async () => { order.push("db"); return { data: null, error: null }; });

    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params());
    expect(res.status).toBe(200);
    expect(deleteObject).toHaveBeenCalledWith(KEY);
    expect(order).toEqual(["r2", "db"]);
  });

  it("未登录 → 401，不动 R2", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params());
    expect(res.status).toBe(401);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("student → 403，不动 R2", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 403, code: "forbidden" });
    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params());
    expect(res.status).toBe(403);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("DB 无此行 → 404，不动 R2", async () => {
    single.mockResolvedValue({ data: null, error: { message: "not found" } });
    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params());
    expect(res.status).toBe(404);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("R2 删除失败 → 502，DB 行保留（不产生孤儿）", async () => {
    deleteObject.mockRejectedValue(new Error("r2 down"));
    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params());
    expect(res.status).toBe(502);
    expect(eqDelete).not.toHaveBeenCalled();
  });

  it("R2 已删但 DB 删除失败 → 502 且标记 orphan，R2 key 记入日志", async () => {
    eqDelete.mockResolvedValue({ data: null, error: { message: "db down" } });
    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "db_delete_failed", orphan: true });
  });

  it("id 非法 uuid → 400", async () => {
    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(400);
  });
});
