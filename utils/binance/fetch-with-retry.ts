const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MIN_REQUEST_SPACING_MS = 120;
const RETRY_JITTER_MS = 200;

interface FetchWithRetryParams {
  url: URL;
  maxRetries?: number;
  baseDelayMs?: number;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let nextAllowedRequestAtMs = 0;
let pacingQueue: Promise<void> = Promise.resolve();

function randomJitter(maxMs: number): number {
  return Math.floor(Math.random() * maxMs);
}

async function waitForPacingSlot(spacingMs: number): Promise<void> {
  const slot = pacingQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedRequestAtMs - now);
    if (waitMs > 0) {
      await delay(waitMs);
    }

    const grantedAt = Date.now();
    nextAllowedRequestAtMs =
      Math.max(nextAllowedRequestAtMs, grantedAt) + spacingMs;
  });

  // Keep queue alive if a previous waiter failed.
  pacingQueue = slot.catch(() => undefined);
  await slot;
}

function parseRetryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) {
    return null;
  }

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const absoluteTs = Date.parse(raw);
  if (Number.isNaN(absoluteTs)) {
    return null;
  }

  return Math.max(0, absoluteTs - Date.now());
}

export async function fetchWithRetry({
  url,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}: FetchWithRetryParams): Promise<Response> {
  let lastError: Error | null = null;
  let lastRetryableResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      await waitForPacingSlot(DEFAULT_MIN_REQUEST_SPACING_MS);
      const response = await fetch(url);

      if (response.ok || !isRetryableStatus(response.status)) {
        return response;
      }

      lastRetryableResponse = response;
      lastError = new Error(
        `Binance request failed: ${response.status} ${response.statusText}`,
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Binance request failed");
    }

    if (attempt < maxRetries) {
      const retryAfterMs = lastRetryableResponse
        ? parseRetryAfterMs(lastRetryableResponse)
        : null;
      const backoffMs = baseDelayMs * 2 ** attempt;
      const boundedRetryAfterMs =
        retryAfterMs !== null && Number.isFinite(retryAfterMs)
          ? retryAfterMs
          : 0;
      await delay(
        Math.max(backoffMs, boundedRetryAfterMs) +
          randomJitter(RETRY_JITTER_MS),
      );
    }
  }

  throw lastError ?? new Error("Binance request failed");
}
