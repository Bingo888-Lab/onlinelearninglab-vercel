import { describe, expect, it } from "vitest";
import { DocumentBody, EmailInput, InviteCodeInput, MAX_UPLOAD_BYTES, PasswordInput, RegisterBody, InviteBody } from "./validation";

describe("shared input schemas", () => {
  it("keeps invite codes case-sensitive and trims equally for creation and registration", () => {
    expect(InviteCodeInput.parse("  AbCd  ")).toBe("AbCd");
    expect(InviteCodeInput.parse("AbCd")).not.toBe(InviteCodeInput.parse("abcd"));
    expect(InviteBody.parse({ code: "  AbCd  ", maxUses: 1 }).code).toBe("AbCd");
    expect(RegisterBody.parse({ email: "a@example.com", password: "12345678", inviteCode: "  AbCd  " }).inviteCode).toBe("AbCd");
    expect(InviteCodeInput.safeParse("   ").success).toBe(false);
    expect(InviteCodeInput.safeParse("abc").success).toBe(false);
  });

  it("accepts email up to 254 chars, rejects longer and whitespace without trimming", () => {
    expect(EmailInput.safeParse(`${"a".repeat(242)}@example.com`).success).toBe(true);
    expect(EmailInput.safeParse(`${"a".repeat(243)}@example.com`).success).toBe(false);
    expect(EmailInput.safeParse(" a@example.com").success).toBe(false);
    expect(EmailInput.safeParse("a@example.com ").success).toBe(false);
  });

  it("enforces 8+ characters and at most 72 UTF-8 bytes", () => {
    expect(PasswordInput.safeParse("12345678").success).toBe(true);
    expect(PasswordInput.safeParse("a".repeat(72)).success).toBe(true);
    expect(PasswordInput.safeParse("a".repeat(73)).success).toBe(false);
    expect(PasswordInput.safeParse("😀".repeat(18)).success).toBe(true);
    expect(PasswordInput.safeParse(`${"a".repeat(68)}😀`).success).toBe(true);
    expect(PasswordInput.safeParse(`${"a".repeat(69)}😀`).success).toBe(false);
  });

  it("permits document sizes just below and at the cap, rejects above", () => {
    const base = { id: "6b0f1a2c-1111-4222-8333-444444444444", title: "Document" };
    expect(DocumentBody.safeParse({ ...base, sizeBytes: MAX_UPLOAD_BYTES - 1 }).success).toBe(true);
    expect(DocumentBody.safeParse({ ...base, sizeBytes: MAX_UPLOAD_BYTES }).success).toBe(true);
    expect(DocumentBody.safeParse({ ...base, sizeBytes: MAX_UPLOAD_BYTES + 1 }).success).toBe(false);
  });
});
