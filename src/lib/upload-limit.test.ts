import { describe, expect, it } from "vitest";
import { getUploadLimitBytes, MAX_UPLOAD_BYTES } from "./upload-limit";

describe("getUploadLimitBytes", () => {
  it("honors positive configuration at, below, and above the hard cap", () => {
    expect(getUploadLimitBytes("10")).toBe(10 * 1024 * 1024);
    expect(getUploadLimitBytes("50")).toBe(MAX_UPLOAD_BYTES);
    expect(getUploadLimitBytes("80")).toBe(MAX_UPLOAD_BYTES);
  });

  it.each([undefined, "", "  ", "not-a-number", "NaN", "Infinity", "0", "-1"])(
    "defaults invalid env %s to the hard cap",
    (raw) => expect(getUploadLimitBytes(raw)).toBe(MAX_UPLOAD_BYTES),
  );
});
