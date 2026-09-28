import { describe, expect, it } from "vitest";
import { getRegistrationMessage } from "./registration-message";

describe("getRegistrationMessage", () => {
  it("asks for email confirmation only when Supabase requires it", () => {
    expect(getRegistrationMessage(true, "learner@example.com")).toEqual({
      title: "请查收确认邮件",
      body: "我们已向 learner@example.com 发送确认链接，点击后即可登录。",
    });
  });

  it("says the account is ready when Supabase auto-confirms it", () => {
    expect(getRegistrationMessage(false, "learner@example.com")).toEqual({
      title: "注册成功",
      body: "账号 learner@example.com 已创建，可以直接登录。",
    });
  });
});
