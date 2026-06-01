const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 200;

const RETRYABLE_DB_ERROR_MESSAGES = [
  "Control plane request failed",
  "Too many database connection attempts are currently ongoing",
  "Failed to acquire permit to connect to the database",
];

function hasNeonRetryableFlag(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const asRecord = value as Record<string, unknown>;
  if (asRecord["neon:retryable"] === true) {
    return true;
  }

  if ("cause" in asRecord) {
    return hasNeonRetryableFlag(asRecord.cause);
  }

  return false;
}

function includesRetryableMessage(error: Error): boolean {
  return RETRYABLE_DB_ERROR_MESSAGES.some((msg) => error.message.includes(msg));
}

export function isRetryableDbError(error: unknown): boolean {
  if (error instanceof Error && includesRetryableMessage(error)) {
    return true;
  }

  if (hasNeonRetryableFlag(error)) {
    return true;
  }

  if (error instanceof Error && error.cause) {
    return isRetryableDbError(error.cause);
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
      await sleep(backoffMs);
    }
  }

  throw new Error("Unreachable retry loop in withDbRetry");
}
