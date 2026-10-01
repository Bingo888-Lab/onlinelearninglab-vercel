import { describe, expect, it, vi } from "vitest";
import { refreshReaderUrl } from "./reader-action";

const response = (ok: boolean, json: () => Promise<unknown>) => ({ ok, json });
describe("refreshReaderUrl", () => {
  it("retains old URL for network/non-ok/bad payload failures and allows a successful retry", async () => {
    let current = "https://old.test/file", busy = false;
    const lock = { current: false }, error = vi.fn(), finish = vi.fn();
    const fetcher = vi.fn().mockRejectedValueOnce(Error("secret-token")).mockResolvedValueOnce(response(false, async () => null)).mockResolvedValueOnce(response(true, async () => null)).mockResolvedValueOnce(response(true, async () => { throw Error("secret-token"); })).mockResolvedValueOnce(response(true, async () => ({ url: "https://" }))).mockResolvedValueOnce(response(true, async () => ({ url: "https://new.test/file" })));
    const run = () => refreshReaderUrl(lock, fetcher as never, "/file", { start: () => { busy = true; }, finish: () => { busy = false; finish(); }, error, success: url => { current = url; } });
    for (let i = 0; i < 5; i++) { await run(); expect(current).toBe("https://old.test/file"); expect(lock.current).toBe(false); expect(busy).toBe(false); }
    await run(); expect(current).toBe("https://new.test/file"); expect(error).toHaveBeenCalledTimes(5); expect(error.mock.calls.every(([message]) => message === undefined)).toBe(true); expect(finish).toHaveBeenCalledTimes(6);
  });
});
