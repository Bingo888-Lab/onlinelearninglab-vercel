import { describe, expect, it } from "vitest";
import { assertSafeE2EResetTarget } from "./e2e-reset-guard";

describe("assertSafeE2EResetTarget", () => {
  it("refuses remote cleanup unless explicitly opted in", () => {
    expect(() => assertSafeE2EResetTarget({ allowed: false, bucket: "online-learning-lab-test" }))
      .toThrow("E2E_ALLOW_REMOTE_RESET must be true");
  });

  it("refuses a bucket without the test suffix", () => {
    expect(() => assertSafeE2EResetTarget({ allowed: true, bucket: "online-learning-lab-prod" }))
      .toThrow("R2_BUCKET must end with -test");
  });

  it("allows cleanup only for an opted-in test bucket", () => {
    expect(() => assertSafeE2EResetTarget({ allowed: true, bucket: "online-learning-lab-test" }))
      .not.toThrow();
  });
});
