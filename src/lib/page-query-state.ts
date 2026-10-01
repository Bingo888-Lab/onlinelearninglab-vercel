export type PageQueryState<T> =
  | { status: "success"; data: T }
  | { status: "error" };

export async function queryPage<T>(query: () => PromiseLike<{ data: T; error: unknown }> | Promise<{ data: T; error: unknown }>): Promise<PageQueryState<T>> {
  try {
    const result = await query();
    return result.error ? { status: "error" } : { status: "success", data: result.data };
  } catch {
    return { status: "error" };
  }
}
