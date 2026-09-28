import { describe, expect, it } from "vitest";
import { assertSafeResetTarget } from "./reset-e2e.mjs";

describe("assertSafeResetTarget", () => {
  it("refuses to wipe remote data without an explicit opt-in", () => {
    expect(() => assertSafeResetTarget({ allowed: false, bucket: "online-learning-lab-test" })).toThrow(
      /E2E_ALLOW_REMOTE_RESET/,
    );
  });

  it("refuses a bucket that is not a test bucket", () => {
    expect(() => assertSafeResetTarget({ allowed: true, bucket: "online-learning-lab-prod" })).toThrow(
      /-test/,
    );
  });

  it("allows the wipe only for an opted-in test bucket", () => {
    expect(() =>
      assertSafeResetTarget({ allowed: true, bucket: "online-learning-lab-test" }),
    ).not.toThrow();
  });
});
