const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 500;

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

export async function fetchWithRetry({
  url,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}: FetchWithRetryParams): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok || !isRetryableStatus(response.status)) {
        return response;
      }

      lastError = new Error(
        `Binance request failed: ${response.status} ${response.statusText}`,
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Binance request failed");
    }

    if (attempt < maxRetries) {
      await delay(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError ?? new Error("Binance request failed");
}
