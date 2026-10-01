const DEFAULT_NEXT = "/";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;
const DOUBLE_ENCODED_PATH_SEPARATOR = /%25(?:2f|5c)/i;

/**
 * Normalize an untrusted `next` value into a root-relative same-origin URL.
 * The returned value is a canonical path, not an absolute URL, so passing it to
 * a router or redirect API cannot reinterpret it as an external origin.
 */
export function getSafeNextPath(next: string | null | undefined, origin: string): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    CONTROL_CHARACTERS.test(next)
  ) {
    return DEFAULT_NEXT;
  }

  try {
    const base = new URL(origin);
    if (base.origin !== origin) return DEFAULT_NEXT;

    const destination = new URL(next, base);
    if (destination.origin !== base.origin) return DEFAULT_NEXT;

    const pathname = destination.pathname;
    if (
      !pathname.startsWith("/") ||
      pathname.startsWith("//") ||
      pathname.includes("\\") ||
      ENCODED_PATH_SEPARATOR.test(pathname) ||
      DOUBLE_ENCODED_PATH_SEPARATOR.test(pathname)
    ) {
      return DEFAULT_NEXT;
    }

    return `${pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_NEXT;
  }
}
