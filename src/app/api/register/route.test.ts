import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const signUp = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc })),
}));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: vi.fn(() => ({ auth: { signUp } })),
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
  signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

describe("POST /api/register", () => {
  it("码有效 → 201，先 consume 后 signUp 并带 confirmation callback", async () => {
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("consume_invite_code", { p_code: "WELCOME" });
    expect(signUp).toHaveBeenCalledWith({
      email: "s@example.com",
      password: "longenough1",
      options: { emailRedirectTo: "http://localhost/auth/confirm" },
    });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(signUp.mock.invocationCallOrder[0]);
    expect(await res.json()).toEqual({ needsEmailConfirmation: true });
  });

  it("码无效 → 400 invite_invalid，且不 signUp（不区分失效原因）", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invite_invalid" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("RPC 报错 → 400，且不 signUp", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invite_invalid" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("可信业务拒绝 → 退还邀请码次数（refund_invite_code）", async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { status: 400, code: "weak_password", message: "private auth detail" } });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(res.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(rpc).toHaveBeenCalledWith("refund_invite_code", { p_code: "WELCOME" });
  });

  it.each([
    { status: 0, code: undefined, label: "retryable network" },
    { status: 503, code: "service_unavailable", label: "retryable 503" },
    { status: 400, code: "unclassified_code", label: "unknown Auth code" },
  ])("$label Auth rejection is outcome unknown and never refunds", async ({ status, code }) => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { status, code, message: "secret Auth response" } });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "signup_failed" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("consume_invite_code", { p_code: "WELCOME" });
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(JSON.stringify(logSpy.mock.calls)).toContain(res.headers.get("X-Request-ID"));
    for (const secret of ["secret Auth response", valid.email, valid.password, valid.inviteCode]) {
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(secret);
    }
    logSpy.mockRestore();
  });

  it.each([
    { result: { data: { user: { id: "u1" }, session: null }, error: { status: 400, code: "weak_password" } }, label: "user present with trusted code" },
    { result: { data: { user: { id: "u1", identities: [] }, session: null }, error: { status: 503, code: "signup_disabled" } }, label: "hidden duplicate with retryable allowlist code" },
    { result: { data: { user: { id: "u1", identities: [] }, session: { access_token: "secret" } }, error: null }, label: "hidden duplicate with session" },
    { result: { data: { user: null, session: null }, error: { status: 503, code: "weak_password" } }, label: "503 with allowlist code" },
  ])("contradictory or retryable $label result is unknown and never refunded", async ({ result }) => {
    signUp.mockResolvedValue(result);
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "signup_failed" });
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("consume_invite_code", { p_code: "WELCOME" });
    expect(JSON.stringify(logSpy.mock.calls)).toContain(res.headers.get("X-Request-ID"));
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("secret");
    logSpy.mockRestore();
  });

  it("normal hidden duplicate with no error or session refunds invite", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1", identities: [] }, session: null }, error: null });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "signup_failed" });
    expect(rpc).toHaveBeenCalledWith("refund_invite_code", { p_code: "WELCOME" });
  });

  it("Auth success-shaped result without user is outcome unknown and never refunds", async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("signUp SDK throw outcome unknown → 不盲目退款且提供安全请求关联号", async () => {
    signUp.mockRejectedValue(new Error("secret SDK payload"));
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "signup_failed" });
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logSpy.mock.calls)).toContain(res.headers.get("X-Request-ID"));
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("secret SDK payload");
    logSpy.mockRestore();
  });

  it("consume RPC throws → identical invite_invalid, no signUp/refund, safe tracking", async () => {
    rpc.mockRejectedValue(new Error("secret RPC detail"));
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invite_invalid" });
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logSpy.mock.calls)).toContain(res.headers.get("X-Request-ID"));
    for (const secret of ["secret RPC detail", valid.email, valid.password, valid.inviteCode]) {
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(secret);
    }
    logSpy.mockRestore();
  });

  it("退款 SDK throw 不逸出注册 route", async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { status: 400, code: "email_exists", message: "secret auth detail" } });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockImplementation(async (name: string) => {
      if (name === "refund_invite_code") throw new Error("secret refund detail");
      return { data: true, error: null };
    });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "signup_failed" });
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(JSON.stringify(logSpy.mock.calls)).toContain(res.headers.get("X-Request-ID"));
    for (const secret of ["secret auth detail", "secret refund detail", valid.email, valid.password, valid.inviteCode]) {
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(secret);
    }
    logSpy.mockRestore();
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

  it("邮箱首尾空白拒绝且不消耗邀请码", async () => {
    const { POST } = await load();
    const res = await POST(body({ ...valid, email: " s@example.com " }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("测试环境自动确认时 signUp 返回 session，API 显示无需确认邮件", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: { access_token: "test" } }, error: null });
    const { POST } = await load();
    const res = await POST(body(valid));
    expect(await res.json()).toEqual({ needsEmailConfirmation: false });
  });
});
