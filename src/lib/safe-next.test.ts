import { describe, expect, it } from "vitest";
import { getSafeNextPath } from "./safe-next";

const ORIGIN = "https://learning.example";

describe("getSafeNextPath", () => {
  it("preserves normalized root-relative paths, query strings, and hashes", () => {
    expect(getSafeNextPath("/documents/42?name=a%2Fb&next=https%3A%2F%2Fevil.test#page-2", ORIGIN)).toBe(
      "/documents/42?name=a%2Fb&next=https%3A%2F%2Fevil.test#page-2",
    );
    expect(getSafeNextPath("/a/../documents/%E2%9C%93", ORIGIN)).toBe("/documents/%E2%9C%93");
    expect(getSafeNextPath("/path?x=1#hash?also=kept", ORIGIN)).toBe("/path?x=1#hash?also=kept");
  });

  it.each([
    "https://evil.test/path",
    "//evil.test/path",
    "///evil.test/path",
    "/\\evil.test/path",
    "/path\\\\evil",
    "javascript:alert(1)",
    "data:text/html,hello",
    "/path\nheader",
    "/path\u0000tail",
    "/%2f%2fevil.test",
    "/%5C%5Cevil.test",
    "/%252f%252fevil.test",
    "/%2e%2e//evil.test",
  ])("rejects unsafe input %s", (next) => {
    expect(getSafeNextPath(next, ORIGIN)).toBe("/");
  });

  it.each([null, undefined, "", "login", "?q=1", "#fragment"]) (
    "uses the default for missing or non-root-relative input %s",
    (next) => {
      expect(getSafeNextPath(next, ORIGIN)).toBe("/");
    },
  );

  it("rejects malformed origins and URL parsing failures", () => {
    expect(getSafeNextPath("/home", "not a URL")).toBe("/");
    expect(getSafeNextPath("/home", "https://learning.example/path")).toBe("/");
    expect(getSafeNextPath("/home", "https://[invalid")).toBe("/");
  });
});
