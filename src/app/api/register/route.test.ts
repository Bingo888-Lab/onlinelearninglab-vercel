import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const createUser = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc, auth: { admin: { createUser } } })),
}));

async function load() {
  vi.resetModules();
  return await import("./route");
}

const body = (o: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/register", { method: "POST", body: JSON.stringify(o) });

const valid = { email: "s@example.com", password: "longenough1", inviteCode: "WELCOME" };

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: true, error: null });
  createUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
});

describe("POST /api/register", () => {
  it("码有效 → 201，先 consume 后 createUser", async () => {
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("consume_invite_code", { p_code: "WELCOME" });
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "s@example.com" }),
    );
    // 顺序：先扣次数再建号
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(createUser.mock.invocationCallOrder[0]);
  });

  it("码无效 → 400 invite_invalid，且不建号（不区分失效原因）", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invite_invalid" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("RPC 报错 → 502，同样不泄露原因", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invite_invalid" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("createUser 失败 → 退还邀请码次数（refund_invite_code）", async () => {
    createUser.mockResolvedValue({ data: { user: null }, error: { message: "already registered" } });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(rpc).toHaveBeenCalledWith("refund_invite_code", { p_code: "WELCOME" });
  });

  it("密码短于 8 → 400，且不碰 RPC（连码都不消耗）", async () => {
    const { POST } = await load();
    const res = await POST(body({ ...valid, password: "short" }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("email 非法 → 400", async () => {
    const { POST } = await load();
    const res = await POST(body({ ...valid, email: "nope" }));
    expect(res.status).toBe(400);
  });

  it("测试环境自动确认时返回 needsEmailConfirmation=false", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(await res.json()).toEqual({ needsEmailConfirmation: true });
  });
});
