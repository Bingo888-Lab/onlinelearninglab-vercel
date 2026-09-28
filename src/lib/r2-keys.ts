const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 预签名绑定的 Content-Type，客户端 PUT 必须发完全一致的值 */
export const PDF_CONTENT_TYPE = "application/pdf";

/**
 * R2 对象 key。刻意不包含原始文件名——文件名只存 DB。
 * 严格校验 uuid，杜绝路径穿越（../、斜杠、点）。
 */
export function buildObjectKey(id: string): string {
  if (!UUID_RE.test(id)) throw new Error("invalid document id");
  return `documents/${id}.pdf`;
}

/** presignPut/presignGet 的 key 白名单，与 buildObjectKey 同规则 */
export function isValidObjectKey(key: string): boolean {
  return /^documents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(key);
}
