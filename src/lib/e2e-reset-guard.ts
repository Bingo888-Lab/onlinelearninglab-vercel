export function assertSafeE2EResetTarget(input: { allowed: boolean; bucket: string }) {
  if (!input.allowed) throw new Error("E2E_ALLOW_REMOTE_RESET must be true");
  if (!input.bucket.endsWith("-test")) throw new Error("R2_BUCKET must end with -test");
}
