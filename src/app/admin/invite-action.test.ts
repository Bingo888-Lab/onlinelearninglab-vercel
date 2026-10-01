import { describe, expect, it, vi } from "vitest";
import { createInvite, updateInvite } from "./invite-action";

const response = (ok: boolean, body: unknown) => ({ ok, json: async () => body });
describe("invite actions", () => {
  it("does not clear or refresh on create failure or unknown response; permits retry", async () => {
    const lock = { current: false }, error = vi.fn(), success = vi.fn(), finish = vi.fn();
    const cb = { start: vi.fn(), finish, error, success };
    const fetcher = vi.fn().mockRejectedValueOnce(Error("secret-token")).mockResolvedValueOnce(response(false, null)).mockResolvedValueOnce(response(true, null)).mockResolvedValueOnce(response(true, { code: "AbCd" }));
    for (let i = 0; i < 3; i++) await createInvite(lock, fetcher as never, { code: "  AbCd  ", maxUses: 2 }, cb);
    expect(error).toHaveBeenCalledTimes(3); expect(success).not.toHaveBeenCalled(); expect(lock.current).toBe(false);
    expect(error.mock.calls.every(([message]) => typeof message === "string" && message.length > 0 && !message.includes("secret-token"))).toBe(true);
    await createInvite(lock, fetcher as never, { code: "  AbCd  ", maxUses: 2 }, cb);
    expect(success).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetcher.mock.calls[3][1].body).code).toBe("AbCd");
  });
  it("list update failure leaves error visible, valid response clears it, and retries", async () => {
    const lock = { current: false }, error = vi.fn(), success = vi.fn();
    const finish = vi.fn();
    const cb = { start: vi.fn(), finish, error, success };
    const fetcher = vi.fn().mockRejectedValueOnce(Error("secret-token")).mockResolvedValueOnce(response(false, {})).mockResolvedValueOnce({ ok: true, json: async () => null }).mockResolvedValueOnce(response(true, { code: "AbCd" }));
    await updateInvite(lock, fetcher as never, "PATCH", "AbCd", { maxUses: 3 }, cb);
    await updateInvite(lock, fetcher as never, "DELETE", "AbCd", null, cb);
    await updateInvite(lock, fetcher as never, "PATCH", "AbCd", { isActive: true }, cb);
    expect(error).toHaveBeenCalledTimes(3); expect(error.mock.calls.every(([message]) => typeof message === "string" && message.length > 0 && !message.includes("secret-token"))).toBe(true); expect(success).not.toHaveBeenCalled(); expect(lock.current).toBe(false);
    await updateInvite(lock, fetcher as never, "PATCH", "AbCd", { isActive: true }, cb);
    expect(success).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledTimes(4); expect(lock.current).toBe(false);
  });
});
