import { z } from "zod";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** POST /api/documents 入库请求体 */
export const DocumentBody = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/** POST /api/documents/[id]/upload-url 请求体 —— 客户端自选 id，服务端只签 key */
export const UploadUrlBody = z.object({
  id: z.string().uuid(),
});

/** POST /api/register 请求体 */
export const RegisterBody = z.object({
  email: z.string().email().max(254),
  // 72 字节是 bcrypt 上限，超了静默截断反而让用户困惑
  password: z.string().min(8).max(72),
  inviteCode: z.string().min(4).max(40),
});

/** POST /api/invites 请求体 */
export const InviteBody = z.object({
  code: z.string().trim().min(4).max(40),
  maxUses: z.number().int().positive().max(10_000),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** PATCH /api/invites/[code] 请求体 */
export const InvitePatchBody = z.object({
  maxUses: z.number().int().positive().max(10_000).optional(),
  isActive: z.boolean().optional(),
});
