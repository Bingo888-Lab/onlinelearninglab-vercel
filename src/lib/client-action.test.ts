import { describe, expect, it, vi } from "vitest";
import { runClientAction } from "./client-action";

describe("runClientAction", () => {
  it("sets and releases synchronous lock on success and enables retry", async () => {
    const lock = { current: false };
    const success = vi.fn();
    const done = vi.fn();
    expect(await runClientAction(lock, async () => "ok", { onSuccess: success, onError: vi.fn(), onFinally: done })).toBe(true);
    expect(success).toHaveBeenCalledWith("ok");
    expect(lock.current).toBe(false);
    await runClientAction(lock, async () => "again", { onSuccess: success, onError: vi.fn() });
    expect(success).toHaveBeenLastCalledWith("again");
  });

  it("handles thrown request and rejected result with visible-error callback, releasing lock", async () => {
    const lock = { current: false };
    const onError = vi.fn();
    await expect(runClientAction(lock, async () => { throw new Error("network"); }, { onSuccess: vi.fn(), onError })).resolves.toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(lock.current).toBe(false);
  });

  it("rejects concurrent activation synchronously", async () => {
    const lock = { current: true };
    const op = vi.fn();
    expect(await runClientAction(lock, op, { onSuccess: vi.fn(), onError: vi.fn() })).toBe(false);
    expect(op).not.toHaveBeenCalled();
  });
});
