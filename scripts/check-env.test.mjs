import { describe, expect, it } from "vitest";
import { findEnvProblems, parseEnv } from "./check-env.mjs";

const ALL_SET = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x",
  R2_ACCOUNT_ID: "8ab65c7069383ded4eef138119570406",
  R2_BUCKET: "online-learning-lab-test",
  R2_ACCESS_KEY_ID: "AK",
  R2_SECRET_ACCESS_KEY: "SK",
};

describe("parseEnv", () => {
  it("reads KEY=value lines and ignores comments and blanks", () => {
    const env = parseEnv("# comment\n\nA=1\nB=two\nnot a pair\n");
    expect(env).toEqual({ A: "1", B: "two" });
  });

  it("strips matching quotes", () => {
    expect(parseEnv('A="quoted"\nB=\'single\'\n')).toEqual({ A: "quoted", B: "single" });
  });

  it("keeps a value containing an equals sign intact", () => {
    expect(parseEnv("A=k=v\n")).toEqual({ A: "k=v" });
  });
});

describe("findEnvProblems", () => {
  it("passes when every required variable has a real-looking value", () => {
    expect(findEnvProblems(ALL_SET)).toEqual([]);
  });

  it("reports each missing variable by name only", () => {
    const withoutBucket = { ...ALL_SET };
    delete withoutBucket.R2_BUCKET;
    expect(findEnvProblems(withoutBucket)).toEqual(["R2_BUCKET: 未设置"]);
  });

  it("rejects an empty value", () => {
    expect(findEnvProblems({ ...ALL_SET, R2_BUCKET: "" })).toEqual(["R2_BUCKET: 为空"]);
  });

  it("rejects a leftover placeholder", () => {
    expect(findEnvProblems({ ...ALL_SET, R2_ACCOUNT_ID: "xxxxxxxx" })).toEqual([
      "R2_ACCOUNT_ID: 仍是占位符",
    ]);
  });
});
