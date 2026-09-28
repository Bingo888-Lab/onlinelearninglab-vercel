import { describe, it, expect, vi, beforeEach } from "vitest";

const getClaims = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getClaims }, from })),
}));

async function load() {
  vi.resetModules();
  return await import("@/lib/auth");
}

const claimRow = (role: string | null | undefined) => {
  from.mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: role === undefined ? null : { role }, error: null }) }),
    }),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  claimRow("student");
});

describe("getUser", () => {
  it("无 claims → userId null", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const { getUser } = await load();
    expect(await getUser()).toEqual({ userId: null, role: null });
  });

  it("有 claims → 返回 userId", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const { getUser } = await load();
    const r = await getUser();
    expect(r.userId).toBe("u1");
  });
});

describe("requireUser", () => {
  it("未登录 → 401", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const { requireUser } = await load();
    const r = await requireUser();
    expect(r).toEqual({ ok: false, status: 401, code: "unauthorized" });
  });

  it("已登录 → ok + userId + role", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    claimRow("admin");
    const { requireUser } = await load();
    const r = await requireUser();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.userId).toBe("u1");
      expect(r.role).toBe("admin");
    }
  });
});

describe("requireAdmin", () => {
  it("未登录 → 401（不是 403，避免泄露资源存在性）", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const { requireAdmin } = await load();
    expect(await requireAdmin()).toEqual({ ok: false, status: 401, code: "unauthorized" });
  });

  it("student → 403", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    claimRow("student");
    const { requireAdmin } = await load();
    expect(await requireAdmin()).toEqual({ ok: false, status: 403, code: "forbidden" });
  });

  it("admin → ok + userId", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    claimRow("admin");
    const { requireAdmin } = await load();
    const r = await requireAdmin();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.userId).toBe("u1");
  });

  it("profile 缺失（trigger 未跑）→ 403 而非 500", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    claimRow(undefined);
    const { requireAdmin } = await load();
    expect(await requireAdmin()).toEqual({ ok: false, status: 403, code: "forbidden" });
  });
});
