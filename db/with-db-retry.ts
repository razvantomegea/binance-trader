const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 200;

const RETRYABLE_DB_ERROR_MESSAGES = [
  "ECONNRESET",
  "connection terminated",
  "Connection terminated unexpectedly",
  "Connection terminated due to connection timeout",
  "sorry, too many clients already",
  "timeout expired",
  "connect ETIMEDOUT",
  "connect ECONNREFUSED",
];

const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "57P01",
]);

function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
}

function includesRetryableMessage(error: Error): boolean {
  return RETRYABLE_DB_ERROR_MESSAGES.some((msg) => error.message.includes(msg));
}

function hasRetryableCode(error: unknown): boolean {
  if (!isObjectLike(error)) {
    return false;
  }
  const { code } = error as Record<string, unknown>;
  return typeof code === "string" && RETRYABLE_ERROR_CODES.has(code);
}

export function isRetryableDbError(
  error: unknown,
  visited: WeakSet<object> = new WeakSet(),
): boolean {
  if (isObjectLike(error)) {
    if (visited.has(error)) {
      return false;
    }
    visited.add(error);
  }

  if (hasRetryableCode(error)) {
    return true;
  }

  if (error instanceof Error && includesRetryableMessage(error)) {
    return true;
  }

  if (error instanceof Error && error.cause) {
    return isRetryableDbError(error.cause, visited);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
  }: {
    maxAttempts?: number;
    baseDelayMs?: number;
  } = {},
): Promise<T> {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isRetryableDbError(error);
      if (!shouldRetry) {
        throw error;
      }

      const backoffMs = baseDelayMs * attempt;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn("[withDbRetry] retrying database operation", {
        attempt,
        maxAttempts,
        errorMessage,
        backoffMs,
      });
      await sleep(backoffMs);
    }
  }

  throw new Error("Unreachable retry loop in withDbRetry");
}
