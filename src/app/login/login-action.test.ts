import { describe, expect, it, vi } from "vitest";
import { submitLogin } from "./login-action";

describe("submitLogin", () => {
  it("surfaces sign-in failures, releases the guard, then navigates on retry", async () => {
    const lock = { current: false }, error = vi.fn(), finish = vi.fn(), navigate = vi.fn();
    const signIn = vi.fn().mockRejectedValueOnce(Error("secret-token")).mockResolvedValueOnce({ error: { message: "bad credentials" } }).mockResolvedValueOnce({ error: null });
    const callbacks = { start: vi.fn(), finish, error };
    await submitLogin(lock, signIn, navigate, callbacks);
    expect(error).toHaveBeenCalledWith("登录暂时不可用，请检查网络后重试"); expect(navigate).not.toHaveBeenCalled(); expect(error.mock.calls[0][0]).not.toContain("secret-token");
    await submitLogin(lock, signIn, navigate, callbacks);
    expect(error).toHaveBeenLastCalledWith("邮箱或密码不正确"); expect(lock.current).toBe(false);
    await submitLogin(lock, signIn, navigate, callbacks);
    expect(navigate).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledTimes(3);
    expect(lock.current).toBe(false);
  });
  it("does not report navigation failure as sign-in failure", async () => {
    const error = vi.fn();
    await expect(submitLogin({ current: false }, async () => ({ error: null }), () => { throw Error(); }, { start: vi.fn(), finish: vi.fn(), error })).rejects.toThrow();
    expect(error).not.toHaveBeenCalled();
  });
});
