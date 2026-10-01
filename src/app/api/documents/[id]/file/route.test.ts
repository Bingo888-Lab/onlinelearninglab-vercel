import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
const requireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({ requireUser, requireAdmin }));

const presignGet = vi.fn(async () => "https://signed.example/doc.pdf?sig=abc");
const presignPut = vi.fn(async () => "https://signed.example/doc.pdf?sig=put");
vi.mock("@/lib/r2", () => ({ presignGet, presignPut }));

const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ from })),
}));

async function load() {
  vi.resetModules();
  return await import("./route");
}

const ID = "6b0f1a2c-1111-4222-8333-444444444444";
const params = () => ({ params: Promise.resolve({ id: ID }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ ok: true, userId: "u1", role: "student" });
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin" });
  single.mockResolvedValue({ data: { id: ID, object_key: `documents/${ID}.pdf` }, error: null });
  presignGet.mockResolvedValue("https://signed.example/doc.pdf?sig=abc");
});

describe("GET /api/documents/[id]/file — 预签名 GET", () => {
  it("已登录 → 200，含 url 与 expiresAt", async () => {
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://signed.example/doc.pdf?sig=abc");
    expect(typeof json.expiresAt).toBe("number");
  });

  it("未登录 → 401，且不查 DB", async () => {
    requireUser.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(401);
    expect(single).not.toHaveBeenCalled();
  });

  it("id 非法 uuid → 400，不查 DB", async () => {
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
    expect(single).not.toHaveBeenCalled();
  });

  it("DB 无此行 → 404", async () => {
    single.mockResolvedValue({ data: null, error: { message: "not found" } });
    const { GET } = await load();
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(404);
    expect(presignGet).not.toHaveBeenCalled();
  });

  it("签名 URL 绝不出现在错误体里（签名即凭据）", async () => {
    presignGet.mockRejectedValue(new Error("boom https://signed.example/doc.pdf?sig=leaked"));
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { GET } = await load();
      const res = await GET(new Request("http://localhost/x"), params());
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "sign_failed" });
      const logs = JSON.stringify(logSpy.mock.calls);
      expect(logs).not.toContain("sig=leaked");
      expect(logs).not.toContain("boom");
      expect(logs).not.toContain("Error:");
      expect(logSpy).toHaveBeenCalledOnce();
      expect(logSpy).toHaveBeenCalledWith({ operation: "document_file_sign", code: "sign_failed", documentId: ID });
    } finally {
      logSpy.mockRestore();
    }
  });
});
