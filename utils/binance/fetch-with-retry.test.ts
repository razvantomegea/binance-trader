import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

async function loadFetchWithRetry() {
  vi.resetModules();
  const mod = await import("./fetch-with-retry");
  return mod.fetchWithRetry;
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers,
  });
}

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ok response on first attempt", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []));

    const promise = fetchWithRetry({ url, maxRetries: 0 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("retries on 429 then succeeds", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    mockFetch
      .mockResolvedValueOnce(jsonResponse(429, {}, { "retry-after": "1" }))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const promise = fetchWithRetry({ url, maxRetries: 2, baseDelayMs: 100 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 then throws after max retries", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    mockFetch.mockResolvedValue(jsonResponse(500, {}));

    const promise = fetchWithRetry({ url, maxRetries: 1, baseDelayMs: 50 });
    const expectation = expect(promise).rejects.toThrow(
      /Binance request failed/,
    );
    await vi.runAllTimersAsync();
    await expectation;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable 400 responses", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    mockFetch.mockResolvedValueOnce(jsonResponse(400, {}));

    const promise = fetchWithRetry({ url, maxRetries: 3 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("retries on network error", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    mockFetch
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const promise = fetchWithRetry({ url, maxRetries: 1, baseDelayMs: 10 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("parses retry-after as an absolute HTTP date", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    const retryAt = new Date(Date.now() + 1000).toUTCString();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(429, {}, { "retry-after": retryAt }))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const promise = fetchWithRetry({ url, maxRetries: 2, baseDelayMs: 100 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("ignores invalid retry-after headers", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(429, {}, { "retry-after": "not-a-delay" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, []));

    const promise = fetchWithRetry({ url, maxRetries: 2, baseDelayMs: 50 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("paces concurrent requests via module queue", async () => {
    const fetchWithRetry = await loadFetchWithRetry();
    const url = new URL("https://example.com/klines");
    mockFetch.mockResolvedValue(jsonResponse(200, []));

    const first = fetchWithRetry({ url, maxRetries: 0 });
    const second = fetchWithRetry({ url, maxRetries: 0 });
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
