/** Run a client request behind a synchronous lock, keeping UI effects outside the request boundary. */
export async function runClientAction<T>(
  lock: { current: boolean },
  operation: () => Promise<T>,
  callbacks: { onStart?: () => void; onSuccess: (value: T) => void; onError: () => void; onFinally?: () => void },
): Promise<boolean> {
  if (lock.current) return false;
  lock.current = true;
  try {
    callbacks.onStart?.();
    let value: T;
    try {
      value = await operation();
    } catch {
      callbacks.onError();
      return false;
    }
    // UI callbacks are deliberately outside the request catch: a navigation or
    // refresh callback failure must not turn a confirmed mutation into failure.
    callbacks.onSuccess(value);
    return true;
  } finally {
    lock.current = false;
    callbacks.onFinally?.();
  }
}
