/** Return the existing SQL LIKE pattern; '%' and '_' intentionally remain wildcards. */
export function getDocumentSearchPattern(query: string): string | null {
  const trimmed = query.trim();
  return trimmed ? `%${trimmed}%` : null;
}
