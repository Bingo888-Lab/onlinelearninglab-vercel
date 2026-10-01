import { describe, expect, it, vi } from "vitest";
import { deleteDocument } from "./delete-action";

const response = (ok: boolean, body: unknown, json = async () => body) => ({ ok, json });
describe("deleteDocument", () => {
  it("keeps failed and unknown responses visible without refreshing; retries after failures", async () => {
    const lock = { current: false }, error = vi.fn(), success = vi.fn(), finish = vi.fn();
    const fetcher = vi.fn().mockRejectedValueOnce(Error("secret-token")).mockResolvedValueOnce(response(false, { error: "db_delete_failed" })).mockResolvedValueOnce(response(true, null)).mockResolvedValueOnce(response(true, null, async () => { throw Error("secret-token"); }));
    const cb = { start: vi.fn(), finish, error, success };
    for (let i = 0; i < 4; i++) await deleteDocument(lock, fetcher as never, "/doc", cb);
    expect(error).toHaveBeenCalledTimes(4); expect(error.mock.calls[1][0]).toContain("记录待管理员核对"); expect(success).not.toHaveBeenCalled(); expect(lock.current).toBe(false);
    expect(error.mock.calls.every(([message]) => typeof message === "string" && message.length > 0 && !message.includes("secret-token"))).toBe(true); expect(finish).toHaveBeenCalledTimes(4);
    await deleteDocument(lock, vi.fn().mockResolvedValue(response(true, { ok: true })) as never, "/doc", cb);
    expect(success).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledTimes(5);
  });
});
