import { describe, expect, it, vi } from "vitest";
import { submitRegistration } from "./register-action";

const response = (status: number, body: unknown) => ({ status, json: async () => body });
describe("submitRegistration", () => {
  it("handles network and malformed/unsuitable responses safely, releases lock, and retries", async () => {
    const lock = { current: false }, error = vi.fn(), success = vi.fn(), finish = vi.fn();
    const cb = { start: vi.fn(), finish, error, success };
    const fetcher = vi.fn().mockRejectedValueOnce(Error("secret-token")).mockResolvedValueOnce(response(500, null)).mockResolvedValueOnce(response(201, null)).mockResolvedValueOnce(response(201, {})).mockResolvedValueOnce({ status: 201, json: async () => { throw Error("secret-token"); } }).mockResolvedValueOnce(response(201, { needsEmailConfirmation: true }));
    for (let i = 0; i < 5; i++) {
      expect(await submitRegistration(lock, fetcher as never, { email: "a", password: "b", inviteCode: "c" }, cb)).toBe(true);
      expect(lock.current).toBe(false);
    }
    expect(error).toHaveBeenCalledTimes(5); expect(success).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toContain("检查邮箱并尝试登录");
    expect(error.mock.calls.every(([message]) => typeof message === "string" && message.length > 0 && !message.includes("secret-token"))).toBe(true);
    await submitRegistration(lock, fetcher as never, { email: "a", password: "b", inviteCode: "c" }, cb);
    expect(success).toHaveBeenCalledWith(true); expect(finish).toHaveBeenCalledTimes(6);
  });
  it("maps valid error object without dereferencing null", async () => {
    const error = vi.fn(), lock = { current: false }, finish = vi.fn();
    await submitRegistration(lock, vi.fn().mockResolvedValue(response(400, { error: "invite_invalid" })) as never, { email: "", password: "", inviteCode: "" }, { start: vi.fn(), finish, error, success: vi.fn() });
    expect(error).toHaveBeenCalledWith("邀请码无效或已过期");
    expect(typeof error.mock.calls[0][0]).toBe("string"); expect(lock.current).toBe(false); expect(finish).toHaveBeenCalledOnce();
  });
  it("uses safe uncertain feedback for signup failure, unknown errors, and malformed JSON; adds only valid request IDs", async () => {
    const lock = { current: false }, error = vi.fn(), finish = vi.fn();
    const headers = { get: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" };
    const fetcher = vi.fn().mockResolvedValueOnce({ status: 502, headers, json: async () => ({ error: "signup_failed", message: "password secret" }) }).mockResolvedValueOnce({ status: 502, headers: { get: () => "not-a-uuid" }, json: async () => ({ error: "secret-token" }) }).mockResolvedValueOnce({ status: 502, headers, json: async () => { throw Error("sensitive detail"); } });
    const callbacks = { start: vi.fn(), finish, error, success: vi.fn() };
    for (let i = 0; i < 3; i++) await submitRegistration(lock, fetcher as never, { email: "a", password: "b", inviteCode: "c" }, callbacks);
    expect(error).toHaveBeenCalledTimes(3);
    expect(error.mock.calls[0][0]).toContain("支持编号：aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(error.mock.calls[0][0]).not.toContain("password secret");
    expect(error.mock.calls[1][0]).not.toContain("not-a-uuid");
    expect(error.mock.calls.every(([message]) => typeof message === "string" && message.length > 0 && !message.includes("secret-token") && !message.includes("sensitive detail"))).toBe(true);
    expect(lock.current).toBe(false); expect(finish).toHaveBeenCalledTimes(3);
  });
});
