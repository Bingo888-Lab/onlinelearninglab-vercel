import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), createServerSupabaseClient: vi.fn(), ilike: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }, children) }));
vi.mock("@/components/logout-button", () => ({ default: () => createElement("button", null, "logout") }));

import Home from "./page";

interface QueryResult { data: unknown; error: unknown }
interface QueryChain extends PromiseLike<QueryResult> {
  select(columns: string): QueryChain;
  order(column: string, options: { ascending: boolean }): QueryChain;
  limit(count: number): QueryChain;
  ilike(column: string, pattern: string): QueryChain;
}

function setup(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain: QueryChain = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    ilike: (column, pattern) => { mocks.ilike(column, pattern); return chain; },
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  mocks.createServerSupabaseClient.mockResolvedValue({ from: () => chain });
  mocks.requireUser.mockResolvedValue({ ok: true, role: "user" });
}

describe("Home page query states", () => {
  beforeEach(() => vi.clearAllMocks());
  it("shows a safe error, keeps search, and does not render empty state", async () => {
    setup(null, new Error("private database detail"));
    const tree = await Home({ searchParams: Promise.resolve({ q: "  book  " }) });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("资料加载失败");
    expect(html).toContain("/?q=book");
    expect(html).not.toContain('data-testid="empty"');
    expect(html).not.toContain("private database detail");
    expect(mocks.ilike).toHaveBeenCalledWith("title", "%book%");
  });
  it("renders empty state only for a successful empty result", async () => {
    setup([]);
    const tree = await Home({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('data-testid="empty"');
  });
  it("applies the search pattern to a successful result", async () => {
    setup([{ id: "doc-1", title: "Book", size_bytes: 128, created_at: "2026-01-01" }]);
    const html = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({ q: "book" }) }));
    expect(mocks.ilike).toHaveBeenCalledWith("title", "%book%");
    expect(html).toContain("Book");
    expect(html).toContain('data-testid="doc-list"');
  });
});
