import { describe, expect, it, vi } from "vitest";
import { configuredUploadLimit, requestSignedUploadUrl, runUploadPipeline, saveDocumentMetadata, validateUploadFile } from "./upload-action";

const file = { name: "test.pdf", type: "application/pdf", size: 1_000 };
describe("upload pipeline", () => {
  it("validates size at, below, and above limit without constructing file bytes", () => {
    const limit = configuredUploadLimit("50");
    expect(validateUploadFile({ ...file, size: limit - 1 }, limit)).toBeNull();
    expect(validateUploadFile({ ...file, size: limit }, limit)).toBeNull();
    expect(validateUploadFile({ ...file, size: limit + 1 }, limit)).toContain("50 MB");
  });
  it("reports signing and PUT failures; unlocks for retries", async () => {
    for (const failAt of ["sign", "put"] as const) {
      const lock = { current: false }, error = vi.fn(), phase = vi.fn(), save = vi.fn();
      const deps = { sign: vi.fn(async () => { if (failAt === "sign") throw Error(); return "https://r2.test"; }), put: vi.fn(async () => { if (failAt === "put") throw Error(); }), save };
      const callbacks = { phase, progress: vi.fn(), start: vi.fn(), finish: vi.fn(), error, success: vi.fn() };
      await runUploadPipeline(lock, file, "doc-id", deps, callbacks);
      expect(error).toHaveBeenCalledWith("上传失败，请检查网络后重试"); expect(error.mock.calls.every(([message]) => typeof message === "string" && message.length > 0)).toBe(true); expect(callbacks.finish).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled(); expect(lock.current).toBe(false);
    }
  });
  it("keeps metadata unknown with document ID and retains file; guard is released for later user action", async () => {
    const lock = { current: false }, error = vi.fn(), phase = vi.fn(), progress = vi.fn(), success = vi.fn();
    const callbacks = { phase, progress, start: vi.fn(), finish: vi.fn(), error, success };
    const save = vi.fn().mockRejectedValueOnce(Error());
    const deps = { sign: vi.fn(async () => "https://r2.test"), put: vi.fn(async (_url: string, _file: typeof file, onProgress: (n: number) => void) => onProgress(100)), save };
    await runUploadPipeline(lock, file, "known-doc", deps, callbacks);
    expect(error.mock.calls[0][0]).toContain("文档 ID：known-doc"); expect(error.mock.calls[0][0]).toBeTruthy(); expect(success).not.toHaveBeenCalled(); expect(lock.current).toBe(false); expect(callbacks.finish).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
    expect(callbacks.finish).toHaveBeenCalledOnce();
  });
  it("confirms a separately completed upload", async () => {
    const lock = { current: false }, phase = vi.fn(), progress = vi.fn(), success = vi.fn();
    const callbacks = { phase, progress, start: vi.fn(), finish: vi.fn(), error: vi.fn(), success };
    await runUploadPipeline(lock, file, "separate-doc", { sign: async () => "https://r2.test", put: async () => {}, save: async () => {} }, callbacks);
    expect(phase).toHaveBeenLastCalledWith("done"); expect(progress).toHaveBeenLastCalledWith(100); expect(success).toHaveBeenCalledOnce(); expect(callbacks.finish).toHaveBeenCalledOnce(); expect(lock.current).toBe(false);
  });
  it("does not misreport confirmed success if the post-save refresh callback throws", async () => {
    const error = vi.fn();
    await expect(runUploadPipeline({ current: false }, file, "id", { sign: async () => "https://r2.test", put: async () => {}, save: async () => {} }, { phase: vi.fn(), progress: vi.fn(), start: vi.fn(), finish: vi.fn(), error, success: () => { throw Error(); } })).rejects.toThrow();
    expect(error).not.toHaveBeenCalled();
  });
  it("rejects thrown, non-2xx, malformed, and mismatched metadata responses", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(Error()).mockResolvedValueOnce({ ok: false, json: async () => ({ id: "doc" }) }).mockResolvedValueOnce({ ok: true, json: async () => null }).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "other" }) });
    for (let i = 0; i < 4; i++) await expect(saveDocumentMetadata(fetcher as never, "doc", file)).rejects.toThrow();
  });
  it("rejects malformed signed URLs without exposing them", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://" }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://bad host/?credential=secret" }) });
    await expect(requestSignedUploadUrl(fetcher as never, "id")).rejects.toThrow();
    await expect(requestSignedUploadUrl(fetcher as never, "id")).rejects.toThrow();
  });
});
