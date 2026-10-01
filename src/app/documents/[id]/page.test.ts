import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), createServerSupabaseClient: vi.fn(), presignGet: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/r2", () => ({ presignGet: mocks.presignGet }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }, children) }));
vi.mock("./reader-frame", () => ({ default: () => createElement("div", null, "reader") }));

import DocumentPage from "./page";

interface QueryResult { data: unknown; error: unknown }
interface QueryChain extends PromiseLike<QueryResult> {
  select(columns: string): QueryChain;
  eq(column: string, value: string): QueryChain;
  maybeSingle(): QueryChain;
}
function setup(result: QueryResult) {
  const chain: QueryChain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => chain,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  mocks.requireUser.mockResolvedValue({ ok: true });
  mocks.createServerSupabaseClient.mockResolvedValue({ from: () => chain });
  mocks.notFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
  mocks.presignGet.mockResolvedValue("signed-url");
}

describe("Document page query states", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not treat query errors as missing or presign a URL", async () => {
    setup({ data: null, error: new Error("private reader detail") });
    const html = renderToStaticMarkup(await DocumentPage({ params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }) }));
    expect(html).toContain("资料加载失败");
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.presignGet).not.toHaveBeenCalled();
    expect(html).not.toContain("private reader detail");
  });
  it("calls notFound only for a successful missing record", async () => {
    setup({ data: null, error: null });
    await expect(DocumentPage({ params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.presignGet).not.toHaveBeenCalled();
  });
});
