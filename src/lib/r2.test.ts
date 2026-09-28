import { describe, it, expect, vi, beforeEach } from "vitest";

const getSignedUrl = vi.fn(
  async (..._args: unknown[]): Promise<string> => "https://signed.example/obj",
);
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

const send = vi.fn(async () => ({ ContentType: "application/pdf", ContentLength: 1234 }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send })),
  PutObjectCommand: class {
    input: unknown;
    constructor(i: unknown) { this.input = i; }
  },
  GetObjectCommand: class {
    input: unknown;
    constructor(i: unknown) { this.input = i; }
  },
  HeadObjectCommand: class {
    input: unknown;
    constructor(i: unknown) { this.input = i; }
  },
  DeleteObjectCommand: class {
    input: unknown;
    constructor(i: unknown) { this.input = i; }
  },
}));

const KEY = "documents/6b0f1a2c-1111-4222-8333-444444444444.pdf";

async function load() {
  vi.resetModules();
  return await import("./r2");
}

beforeEach(() => {
  getSignedUrl.mockClear();
  send.mockClear();
  process.env.R2_ACCOUNT_ID = "acct";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_ACCESS_KEY_ID = "ak";
  process.env.R2_SECRET_ACCESS_KEY = "sk";
  process.env.R2_SIGN_TTL_SECONDS = "300";
});

describe("presignPut", () => {
  it("PutObjectCommand 的 ContentType 恰为 application/pdf", async () => {
    const { presignPut } = await load();
    await presignPut(KEY);
    const cmd = getSignedUrl.mock.calls[0][1] as { input: { ContentType: string } };
    expect(cmd.input.ContentType).toBe("application/pdf");
  });
  it("expire 默认 300 秒", async () => {
    const { presignPut } = await load();
    await presignPut(KEY);
    expect(getSignedUrl.mock.calls[0][2]).toEqual({ expiresIn: 300 });
  });

  it("拒绝非 documents/<uuid>.pdf 的 key", async () => {
    const { presignPut } = await load();
    expect(() => presignPut("documents/../secret.pdf")).toThrow();
    expect(() => presignPut("other/6b0f1a2c-1111-4222-8333-444444444444.pdf")).toThrow();
    expect(() => presignPut("documents/6b0f1a2c-1111-4222-8333-444444444444.txt")).toThrow();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});

describe("presignGet", () => {
  it("用 R2_SIGN_TTL_SECONDS 作为 expiresIn", async () => {
    process.env.R2_SIGN_TTL_SECONDS = "600";
    const { presignGet } = await load();
    await presignGet(KEY);
    expect(getSignedUrl.mock.calls[0][2]).toEqual({ expiresIn: 600 });
  });

  it("拒绝非法 key", async () => {
    const { presignGet } = await load();
    expect(() => presignGet("../../etc/passwd")).toThrow();
  });
});

describe("headObject", () => {
  it("返回 HeadObject 结果", async () => {
    const { headObject } = await load();
    const r = await headObject(KEY);
    expect(r.ContentType).toBe("application/pdf");
    expect(r.ContentLength).toBe(1234);
  });
});

describe("deleteObject", () => {
  it("拒绝非法 key，避免误删", async () => {
    const { deleteObject } = await load();
    await expect(deleteObject("documents/anything")).rejects.toThrow("invalid object key");
    expect(send).not.toHaveBeenCalled();
  });
});
