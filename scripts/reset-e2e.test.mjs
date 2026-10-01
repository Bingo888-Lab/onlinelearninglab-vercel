import { describe, expect, it, vi } from "vitest";
import { SafeResetTargetError, withSafeResetTarget } from "./reset-e2e-guard.mjs";

const safeConfig = {
  allowed: true,
  supabaseUrl: "https://xleewqxbjfetctmsjquk.supabase.co",
  bucket: "online-learning-lab-test",
};

const rejectedConfigs = [
  ["undefined configuration", undefined, "configuration"],
  ["null configuration", null, "configuration"],
  ["array configuration", [], "configuration"],
  ["missing opt-in", { ...safeConfig, allowed: undefined }, "E2E_ALLOW"],
  ["false opt-in", { ...safeConfig, allowed: false }, "E2E_ALLOW"],
  ["string opt-in", { ...safeConfig, allowed: "1" }, "E2E_ALLOW"],
  ["missing URL", { ...safeConfig, supabaseUrl: undefined }, "Supabase URL"],
  ["empty URL", { ...safeConfig, supabaseUrl: "" }, "Supabase URL"],
  ["non-string URL", { ...safeConfig, supabaseUrl: {} }, "Supabase URL"],
  ["malformed URL", { ...safeConfig, supabaseUrl: "not a URL" }, "Supabase URL"],
  ["raw control character", { ...safeConfig, supabaseUrl: `${safeConfig.supabaseUrl}\n` }, "Supabase URL"],
  ["backslash", { ...safeConfig, supabaseUrl: `${safeConfig.supabaseUrl}\\@evil.test` }, "Supabase URL"],
  ["leading whitespace", { ...safeConfig, supabaseUrl: ` ${safeConfig.supabaseUrl}` }, "Supabase URL"],
  ["unknown valid Supabase host", { ...safeConfig, supabaseUrl: "https://unknown-project.supabase.co" }, "Supabase 项目"],
  ["host lookalike", { ...safeConfig, supabaseUrl: `${safeConfig.supabaseUrl}.evil.test` }, "Supabase 项目"],
  ["production project with test bucket", { ...safeConfig, supabaseUrl: "https://production.supabase.co" }, "Supabase 项目"],
  ["HTTP scheme", { ...safeConfig, supabaseUrl: safeConfig.supabaseUrl.replace("https:", "http:") }, "HTTPS"],
  ["unexpected port", { ...safeConfig, supabaseUrl: `${safeConfig.supabaseUrl}:8443` }, "Supabase URL"],
  ["path", { ...safeConfig, supabaseUrl: `${safeConfig.supabaseUrl}/other` }, "Supabase URL"],
  ["query", { ...safeConfig, supabaseUrl: `${safeConfig.supabaseUrl}?token=query-secret` }, "Supabase URL"],
  ["fragment", { ...safeConfig, supabaseUrl: `${safeConfig.supabaseUrl}#secret` }, "Supabase URL"],
  ["userinfo", { ...safeConfig, supabaseUrl: "https://user:password@xleewqxbjfetctmsjquk.supabase.co" }, "Supabase URL"],
  ["missing bucket", { ...safeConfig, bucket: undefined }, "R2_BUCKET"],
  ["empty bucket", { ...safeConfig, bucket: "" }, "R2_BUCKET"],
  ["production bucket", { ...safeConfig, bucket: "online-learning-lab-production" }, "R2_BUCKET"],
  ["other test bucket", { ...safeConfig, bucket: "another-project-test" }, "R2_BUCKET"],
  ["test project with wrong bucket", { ...safeConfig, bucket: "wrong-bucket" }, "R2_BUCKET"],
];

describe("reset target guard", () => {
  it.each(rejectedConfigs)("rejects %s before invoking cleanup", async (_name, config, category) => {
    const cleanup = vi.fn();
    const result = withSafeResetTarget(config, cleanup);
    await expect(result).rejects.toBeInstanceOf(SafeResetTargetError);
    await expect(result).rejects.toThrow(category);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("does not expose query or userinfo secrets in rejection messages", async () => {
    for (const supabaseUrl of [
      `${safeConfig.supabaseUrl}?token=query-secret`,
      "https://user:password@xleewqxbjfetctmsjquk.supabase.co",
    ]) {
      const cleanup = vi.fn();
      const result = withSafeResetTarget({ ...safeConfig, supabaseUrl }, cleanup);
      await expect(result).rejects.toBeInstanceOf(SafeResetTargetError);
      await expect(result).rejects.not.toThrow("query-secret");
      await expect(result).rejects.not.toThrow("password");
      await expect(result).rejects.not.toThrow(supabaseUrl);
      expect(cleanup).not.toHaveBeenCalled();
    }
  });

  it.each([safeConfig.supabaseUrl, `${safeConfig.supabaseUrl}/`, `${safeConfig.supabaseUrl}:443/`])(
    "allows the explicit test target %s without real cleanup",
    async (supabaseUrl) => {
      const cleanup = vi.fn().mockResolvedValue("done");
      await expect(withSafeResetTarget({ ...safeConfig, supabaseUrl }, cleanup)).resolves.toBe("done");
      expect(cleanup).toHaveBeenCalledOnce();
    },
  );
});
