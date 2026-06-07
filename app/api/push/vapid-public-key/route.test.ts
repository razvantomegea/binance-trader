import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "./route";

const VALID_VAPID_PUBLIC_KEY = "A".repeat(88);

describe("GET /api/push/vapid-public-key", () => {
  beforeEach(() => {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  });

  afterEach(() => {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  });

  it("returns 503 when web push is not configured", async () => {
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Web push is not configured",
    });
  });

  it("returns 503 when key format is invalid", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "short-key";

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "WEB_PUSH_VAPID_PUBLIC_KEY has invalid format",
    });
  });

  it("returns 200 with normalized public key", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = `"${VALID_VAPID_PUBLIC_KEY}"`;

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      publicKey: VALID_VAPID_PUBLIC_KEY,
    });
  });
});
