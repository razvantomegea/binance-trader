import { afterEach, describe, expect, it, vi } from "vitest";

import { hasValidCronSecret } from "./cron-secret-auth";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/cron", { headers });
}

describe("hasValidCronSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");

    expect(
      hasValidCronSecret(
        makeRequest({
          authorization: "Bearer secret",
          "x-cron-secret": "secret",
        }),
      ),
    ).toBe(false);
  });

  it("returns false when no token is provided", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(hasValidCronSecret(makeRequest({}))).toBe(false);
  });

  it("returns true when Bearer token matches CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(
      hasValidCronSecret(makeRequest({ authorization: "Bearer my-secret" })),
    ).toBe(true);
  });

  it("returns true when Bearer token is trimmed", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(
      hasValidCronSecret(makeRequest({ authorization: "Bearer  my-secret  " })),
    ).toBe(true);
  });

  it("returns false when Bearer token does not match", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(
      hasValidCronSecret(makeRequest({ authorization: "Bearer wrong" })),
    ).toBe(false);
  });

  it("ignores authorization header without Bearer prefix", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(
      hasValidCronSecret(
        makeRequest({
          authorization: "my-secret",
          "x-cron-secret": "my-secret",
        }),
      ),
    ).toBe(true);
  });

  it("returns true when x-cron-secret header matches", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(
      hasValidCronSecret(makeRequest({ "x-cron-secret": "my-secret" })),
    ).toBe(true);
  });

  it("returns true when x-cron-secret header is trimmed", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(
      hasValidCronSecret(makeRequest({ "x-cron-secret": "  my-secret  " })),
    ).toBe(true);
  });

  it("returns false when x-cron-secret header does not match", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(hasValidCronSecret(makeRequest({ "x-cron-secret": "wrong" }))).toBe(
      false,
    );
  });

  it("prefers Bearer token over x-cron-secret when both are present", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");

    expect(
      hasValidCronSecret(
        makeRequest({
          authorization: "Bearer my-secret",
          "x-cron-secret": "wrong",
        }),
      ),
    ).toBe(true);
  });
});
