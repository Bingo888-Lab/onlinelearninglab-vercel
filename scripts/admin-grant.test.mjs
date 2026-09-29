import { describe, expect, it } from "vitest";
import { resolveAdminArgs } from "./admin-grant.mjs";

describe("resolveAdminArgs", () => {
  it("reads email and defaults to .env.local", () => {
    expect(resolveAdminArgs(["--email", "a@b.com"])).toEqual({
      email: "a@b.com",
      envFile: ".env.local",
    });
  });

  it("accepts an explicit env file so production can be targeted", () => {
    expect(resolveAdminArgs(["--email", "A@B.com", "--env-file", ".env.prod.local"])).toEqual({
      email: "a@b.com",
      envFile: ".env.prod.local",
    });
  });

  it("reports which argument is missing", () => {
    expect(resolveAdminArgs([])).toEqual({
      error: "用法：pnpm admin:grant --email you@example.com [--env-file .env.prod.local]",
    });
    expect(resolveAdminArgs(["--email"])).toEqual({
      error: "用法：pnpm admin:grant --email you@example.com [--env-file .env.prod.local]",
    });
  });
});
