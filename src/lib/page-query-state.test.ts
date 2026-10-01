import { describe, expect, it } from "vitest";
import { queryPage } from "./page-query-state";

describe("page query states", () => {
  it("distinguishes successful empty data from SDK errors and thrown exceptions", async () => {
    expect(await queryPage(async () => ({ data: [], error: null }))).toEqual({ status: "success", data: [] });
    expect(await queryPage(async () => ({ data: null, error: new Error("private db detail") }))).toEqual({ status: "error" });
    expect(await queryPage(async () => { throw new Error("private thrown detail"); })).toEqual({ status: "error" });
  });
});
