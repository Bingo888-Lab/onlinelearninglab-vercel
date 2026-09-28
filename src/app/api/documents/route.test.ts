import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
const requireUser = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAdmin, requireUser }));

const headObject = vi.fn();
vi.mock("@/lib/r2", () => ({ headObject, presignPut: vi.fn(), presignGet: vi.fn(), deleteObject: vi.fn() }));

const insert = vi.fn();
const order = vi.fn();
const ilike = vi.fn();
const limit = vi.fn();
const select = vi.fn();
const from = vi.fn(() => ({ insert, select }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ from })),
}));

async function load() {
  vi.resetModules();
  return await import("./route");
}

const ID = "6b0f1a2c-1111-4222-8333-444444444444";
const KEY = `documents/${ID}.pdf`;

function body(over: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/documents", {
    method: "POST",
    body: JSON.stringify({ id: ID, title: "Lecture 1", sizeBytes: 1234, ...over }),
  });
}

function admin() {
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin" });
}
function student() {
  requireAdmin.mockResolvedValue({ ok: false, status: 403, code: "forbidden" });
}

beforeEach(() => {
  vi.clearAllMocks();
  admin();
  headObject.mockResolvedValue({ ContentType: "application/pdf", ContentLength: 1234 });
  insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: ID }, error: null }) }) });
  select.mockReturnValue({ order: (...a: unknown[]) => order(...a) });
  order.mockReturnValue({ limit: (...a: unknown[]) => limit(...a) });
  limit.mockResolvedValue({ data: [{ id: ID }], error: null });
});

describe("POST /api/documents — 授权", () => {
  it("未登录 → 401", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { POST } = await load();
    const res = await POST(body());
    expect(res.status).toBe(401);
    expect(headObject).not.toHaveBeenCalled();
  });

  it("student → 403", async () => {
    student();
    const { POST } = await load();
    const res = await POST(body());
    expect(res.status).toBe(403);
    expect(headObject).not.toHaveBeenCalled();
  });
});

describe("POST /api/documents — 入库核验", () => {
  it("headObject 抛错（对象不存在）→ 400 object_missing，且不入库", async () => {
    headObject.mockRejectedValue(new Error("NotFound"));
    const { POST } = await load();
    const res = await POST(body());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "object_missing" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("大小与上报不符 → 400 size_mismatch，且不入库", async () => {
    headObject.mockResolvedValue({ ContentType: "application/pdf", ContentLength: 999 });
    const { POST } = await load();
    const res = await POST(body());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "size_mismatch" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("ContentType 非 application/pdf → 400 content_type_mismatch", async () => {
    headObject.mockResolvedValue({ ContentType: "text/html", ContentLength: 1234 });
    const { POST } = await load();
    const res = await POST(body());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "content_type_mismatch" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("合法 → 201，入库行含 object_key", async () => {
    const { POST } = await load();
    const res = await POST(body());
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, object_key: KEY, size_bytes: 1234, uploaded_by: "admin-1" }),
    );
  });

  it("id 不是 uuid → 400 invalid_input，不碰 R2", async () => {
    const { POST } = await load();
    const res = await POST(body({ id: "../../etc" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(headObject).not.toHaveBeenCalled();
  });

  it("title 超长 → 400", async () => {
    const { POST } = await load();
    const res = await POST(body({ title: "x".repeat(201) }));
    expect(res.status).toBe(400);
  });

  it("sizeBytes 超 50MB → 400", async () => {
    const { POST } = await load();
    const res = await POST(body({ sizeBytes: 51 * 1024 * 1024 }));
    expect(res.status).toBe(400);
  });

  it("DB 插入失败 → 502 insert_failed", async () => {
    insert.mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: { message: "boom" } }) }) });
    const { POST } = await load();
    const res = await POST(body());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "insert_failed" });
  });
});

describe("GET /api/documents", () => {
  it("未登录 → 401", async () => {
    requireUser.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/api/documents"));
    expect(res.status).toBe(401);
  });

  it("已登录 → 按 created_at 倒序返回", async () => {
    requireUser.mockResolvedValue({ ok: true, userId: "u1", role: "student" });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/api/documents"));
    expect(res.status).toBe(200);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("带 ?q= → ilike 查询标题", async () => {
    requireUser.mockResolvedValue({ ok: true, userId: "u1", role: "student" });
    ilike.mockReturnValue({ order: (...a: unknown[]) => order(...a) });
    select.mockReturnValue({ ilike: (...a: unknown[]) => ilike(...a) });
    const { GET } = await load();
    await GET(new Request("http://localhost/api/documents?q=lecture"));
    expect(ilike).toHaveBeenCalledWith("title", "%lecture%");
  });

  it("查询失败 → 502", async () => {
    requireUser.mockResolvedValue({ ok: true, userId: "u1", role: "student" });
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/api/documents"));
    expect(res.status).toBe(502);
  });
});
