import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

async function load() {
  vi.resetModules();
  return await import("./route");
}

function req(query: string) {
  return new Request(`https://learn.example/auth/confirm${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ data: { user: { id: "u1" }, session: {} }, error: null });
});

describe("GET /auth/confirm", () => {
  it("valid token hash → verifyOtp and redirect to /", async () => {
    const { GET } = await load();
    const res = await GET(req("?token_hash=opaque&type=email"));
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "opaque", type: "email" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://learn.example/");
  });

  it("valid next path → redirect within same origin", async () => {
    const { GET } = await load();
    const res = await GET(req("?token_hash=opaque&type=email&next=%2Fadmin"));
    expect(res.headers.get("location")).toBe("https://learn.example/admin");
  });

  it("external next URL → ignore it and redirect to /", async () => {
    const { GET } = await load();
    const res = await GET(req("?token_hash=opaque&type=email&next=https%3A%2F%2Fevil.example"));
    expect(res.headers.get("location")).toBe("https://learn.example/");
  });

  it("missing token hash → /login error, do not call verifyOtp", async () => {
    const { GET } = await load();
    const res = await GET(req("?type=email"));
    expect(res.headers.get("location")).toContain("/login?error=confirmation_failed");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("invalid OTP → /login error and must not leak token hash", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "invalid opaque" } });
    const { GET } = await load();
    const res = await GET(req("?token_hash=opaque&type=email"));
    expect(res.headers.get("location")).toContain("/login?error=confirmation_failed");
    expect(res.headers.get("location")).not.toContain("opaque");
  });
});
