/** Accept only absolute HTTPS URLs with a parseable host. Never expose the URL on failure. */
export function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}
