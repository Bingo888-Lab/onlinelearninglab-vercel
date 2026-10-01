export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** raw is configured in MiB. Invalid/missing values fail closed to the hard cap. */
export function getUploadLimitBytes(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return MAX_UPLOAD_BYTES;
  const megabytes = Number(raw);
  const configuredBytes = megabytes * 1024 * 1024;
  if (!Number.isFinite(configuredBytes) || configuredBytes <= 0) return MAX_UPLOAD_BYTES;
  return Math.min(configuredBytes, MAX_UPLOAD_BYTES);
}
