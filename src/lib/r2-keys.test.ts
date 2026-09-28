import { describe, it, expect } from "vitest";
import { buildObjectKey, PDF_CONTENT_TYPE } from "./r2-keys";

describe("buildObjectKey", () => {
  it("返回 documents/<uuid>.pdf 形式，不含原始文件名", () => {
    const key = buildObjectKey("6b0f1a2c-1111-4222-8333-444444444444");
    expect(key).toBe("documents/6b0f1a2c-1111-4222-8333-444444444444.pdf");
  });

  it("不接受路径穿越字符", () => {
    expect(() => buildObjectKey("../secret")).toThrow();
    expect(() => buildObjectKey("documents/../../etc/passwd")).toThrow();
    expect(() => buildObjectKey("")).toThrow();
  });

  it("只接受合法 uuid", () => {
    expect(() => buildObjectKey("not-a-uuid")).toThrow();
    expect(() => buildObjectKey("6b0f1a2c11114222833344444444444")).toThrow();
  });
});

describe("PDF_CONTENT_TYPE", () => {
  it("固定为 application/pdf，客户端 PUT 必须带同一值", () => {
    expect(PDF_CONTENT_TYPE).toBe("application/pdf");
  });
});
