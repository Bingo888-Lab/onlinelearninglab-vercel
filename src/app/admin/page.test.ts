import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), createServerSupabaseClient: vi.fn(), createAdminClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }, children) }));
vi.mock("./upload-form", () => ({ default: () => createElement("div", null, "upload") }));
vi.mock("./delete-button", () => ({ DeleteButton: () => createElement("button", null, "delete") }));
interface InviteRow { code: string; max_uses: number; used_count: number; expires_at: string | null; is_active: boolean }
interface InviteListProps { invites: InviteRow[] }
vi.mock("./invite-forms", () => ({ InviteCreateForm: () => createElement("div", null, "invite form"), InviteList: ({ invites }: InviteListProps) => createElement("div", { "data-testid": "invite-list" }, `invites:${invites.length}`) }));

import AdminPage from "./page";

interface QueryResult { data: unknown; error: unknown }
interface QueryChain extends PromiseLike<QueryResult> {
  select(columns: string): QueryChain;
  order(column: string, options: { ascending: boolean }): QueryChain;
  limit(count: number): QueryChain;
}
function chainResult(result: QueryResult): QueryChain {
  const chain: QueryChain = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}
function setup(docResult: QueryResult, inviteResult: QueryResult) {
  mocks.requireAdmin.mockResolvedValue({ ok: true });
  mocks.createServerSupabaseClient.mockResolvedValue({ from: () => chainResult(docResult) });
  mocks.createAdminClient.mockReturnValue({ from: () => chainResult(inviteResult) });
}

describe("Admin page query states", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps document and invite failures independent", async () => {
    setup({ data: null, error: new Error("private docs detail") }, { data: [], error: null });
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).toContain("资料加载失败");
    expect(html).not.toContain('data-testid="admin-empty"');
    expect(html).toContain('data-testid="invite-list"');
    expect(html).not.toContain("private docs detail");
  });
  it("shows invite error without rendering InviteList while documents can be empty", async () => {
    setup({ data: [], error: null }, { data: null, error: new Error("private invite detail") });
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).toContain('data-testid="admin-empty"');
    expect(html).toContain("邀请码加载失败");
    expect(html).not.toContain('data-testid="invite-list"');
    expect(html).not.toContain("private invite detail");
  });
});
