import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
const requireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({ requireUser, requireAdmin }));

const presignPut = vi.fn(async () => "https://signed.example/doc.pdf?sig=put");
vi.mock("@/lib/r2", () => ({ presignPut, presignGet: vi.fn(), headObject: vi.fn(), deleteObject: vi.fn() }));
const maybeSingle = vi.fn<() => Promise<{
  data: { id: string } | null;
  error: { message: string } | null;
}>>(async () => ({ data: null, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ from })) }));

async function load() {
  vi.resetModules();
  return await import("./route");
}

const ID = "6b0f1a2c-1111-4222-8333-444444444444";
const body = (over: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/documents/x/upload-url", {
    method: "POST",
    body: JSON.stringify({ id: ID, ...over }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin" });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  presignPut.mockResolvedValue("https://signed.example/doc.pdf?sig=put");
});

describe("POST /api/documents/[id]/upload-url — 预签名 PUT", () => {
  it("admin → 200，返回 url 与 objectKey", async () => {
    const { POST } = await load();
    const res = await POST(body(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://signed.example/doc.pdf?sig=put");
    expect(json.objectKey).toBe(`documents/${ID}.pdf`);
  });

  it("path id 与 body id 不一致 → 400，不签发", async () => {
    const { POST } = await load();
    const res = await POST(body({ id: "11111111-1111-4111-8111-111111111111" }), {
      params: Promise.resolve({ id: ID }),
    });
    expect(res.status).toBe(400);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("未登录 → 401", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { POST } = await load();
    const res = await POST(body(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(401);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("student → 403", async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 403, code: "forbidden" });
    const { POST } = await load();
    const res = await POST(body(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(403);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("id 非法 → 400", async () => {
    const { POST } = await load();
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ id: "nope" }) }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("签名失败 → 502，url 不入错误体", async () => {
    presignPut.mockRejectedValue(new Error("boom https://signed.example/x?sig=leaked"));
    const { POST } = await load();
    const res = await POST(body(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("sig=leaked");
  });

  it("已存在 document id → 409，不签发覆盖 URL", async () => {
    maybeSingle.mockResolvedValue({ data: { id: ID }, error: null });
    const { POST } = await load();
    const res = await POST(body(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "document_exists" });
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("预查失败 → 502 query_failed，不签发", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "secret db detail" } });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await load();
    const res = await POST(body(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(502);
    const responseText = await res.text();
    expect(JSON.parse(responseText)).toEqual({ error: "query_failed" });
    expect(responseText).not.toContain("secret db detail");
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("secret db detail");
    expect(presignPut).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("precheck rejected → 502 query_failed without signing", async () => {
    maybeSingle.mockRejectedValue(new Error("secret DB response"));
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await load();
    const res = await POST(body(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "query_failed" });
    expect(presignPut).not.toHaveBeenCalled();
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("secret DB response");
    logSpy.mockRestore();
  });
});
