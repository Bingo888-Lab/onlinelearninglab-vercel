import { describe, expect, it } from "vitest";
import { getDocumentSearchPattern } from "./document-search";

describe("getDocumentSearchPattern", () => {
  it("ignores empty and whitespace-only searches", () => {
    expect(getDocumentSearchPattern("")).toBeNull();
    expect(getDocumentSearchPattern("  \t ")).toBeNull();
  });

  it("wraps ordinary text and deliberately preserves SQL LIKE wildcards", () => {
    expect(getDocumentSearchPattern(" lecture ")).toBe("%lecture%");
    expect(getDocumentSearchPattern("%" )).toBe("%%%");
    expect(getDocumentSearchPattern("_" )).toBe("%_%");
  });
});
