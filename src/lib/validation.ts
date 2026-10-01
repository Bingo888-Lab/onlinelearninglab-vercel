import { z } from "zod";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const EmailInput = z.string().email().max(254);
// Supabase Auth's upstream Go implementation declares MaxPasswordLength = 72 and checks
// len(password) (Go string length is bytes, including UTF-8 bytes), documented at
// https://github.com/supabase/auth/blob/master/internal/api/password.go.
// This is an application-side 72-byte contract; hosted Auth instance versions are unknown,
// and this does not claim that an upstream service truncates passwords.
export const PasswordInput = z
  .string()
  .min(8)
  .refine((password) => new TextEncoder().encode(password).byteLength <= 72);
export const InviteCodeInput = z.string().trim().min(4).max(40);

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
  // Email is deliberately not trimmed: leading/trailing whitespace is invalid input.
  email: EmailInput,
  password: PasswordInput,
  inviteCode: InviteCodeInput,
});

/** POST /api/invites 请求体 */
export const InviteBody = z.object({
  code: InviteCodeInput,
  maxUses: z.number().int().positive().max(10_000),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** PATCH /api/invites/[code] 请求体 */
export const InvitePatchBody = z.object({
  maxUses: z.number().int().positive().max(10_000).optional(),
  isActive: z.boolean().optional(),
});
