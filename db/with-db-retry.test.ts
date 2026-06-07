import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isRetryableDbError, withDbRetry } from "./with-db-retry";

describe("isRetryableDbError", () => {
  it.each([
    "Control plane request failed: temporary outage",
    "Too many database connection attempts are currently ongoing",
    "Failed to acquire permit to connect to the database",
  ])("returns true for retryable message: %s", (message) => {
    expect(isRetryableDbError(new Error(message))).toBe(true);
  });

  it("returns false for neon flag object due to shared visited set", () => {
    expect(isRetryableDbError({ "neon:retryable": true })).toBe(false);
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableDbError(new Error("syntax error at or near"))).toBe(
      false,
    );
    expect(isRetryableDbError("not an error")).toBe(false);
  });

  it("returns true when nested cause has retryable message", () => {
    const error = new Error("wrapper", {
      cause: new Error("Control plane request failed: timeout"),
    });

    expect(isRetryableDbError(error)).toBe(true);
  });

  it("returns false when the same object is visited twice", () => {
    const error = new Error("outer", { cause: new Error("inner") });
    const visited = new WeakSet<object>();
    visited.add(error);

    expect(isRetryableDbError(error, visited)).toBe(false);
  });

  it("returns false for circular error causes", () => {
    const inner = new Error("inner");
    const outer = new Error("outer", { cause: inner });
    inner.cause = outer;

    expect(isRetryableDbError(outer)).toBe(false);
  });

  it("returns false for object-like non-error values", () => {
    expect(isRetryableDbError(() => undefined)).toBe(false);
  });

  it("returns false when error cause points back to itself", () => {
    const error = new Error("loop") as Error & { cause?: unknown };
    error.cause = error;

    expect(isRetryableDbError(error)).toBe(false);
  });
});

describe("withDbRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns operation result on first success", async () => {
    const operation = vi.fn().mockResolvedValue("ok");

    await expect(withDbRetry(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors with backoff then succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "Too many database connection attempts are currently ongoing",
        ),
      )
      .mockResolvedValue("recovered");

    const promise = withDbRetry(operation, {
      maxAttempts: 3,
      baseDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalled();
  });

  it("throws immediately for non-retryable errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("permission denied"));

    await expect(withDbRetry(operation, { maxAttempts: 3 })).rejects.toThrow(
      "permission denied",
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retry attempts", async () => {
    const retryable = new Error(
      "Failed to acquire permit to connect to the database",
    );
    const operation = vi.fn().mockRejectedValue(retryable);

    const promise = withDbRetry(operation, { maxAttempts: 3, baseDelayMs: 50 });
    const assertion = expect(promise).rejects.toThrow(
      "Failed to acquire permit to connect to the database",
    );

    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("logs stringified message when rejection is not an Error", async () => {
    const operation = vi.fn().mockRejectedValue("plain string failure");

    await expect(withDbRetry(operation, { maxAttempts: 1 })).rejects.toBe(
      "plain string failure",
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("throws unreachable error when maxAttempts is zero", async () => {
    const operation = vi.fn().mockResolvedValue("ok");

    await expect(withDbRetry(operation, { maxAttempts: 0 })).rejects.toThrow(
      "Unreachable retry loop in withDbRetry",
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it("applies increasing backoff across multiple retry attempts", async () => {
    const retryable = new Error(
      "Too many database connection attempts are currently ongoing",
    );
    const operation = vi
      .fn()
      .mockRejectedValueOnce(retryable)
      .mockRejectedValueOnce(retryable)
      .mockResolvedValue("ok");

    const promise = withDbRetry(operation, {
      maxAttempts: 4,
      baseDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(
      "[withDbRetry] retrying database operation",
      expect.objectContaining({ attempt: 1, backoffMs: 100 }),
    );
    expect(console.warn).toHaveBeenCalledWith(
      "[withDbRetry] retrying database operation",
      expect.objectContaining({ attempt: 2, backoffMs: 200 }),
    );
  });
});
