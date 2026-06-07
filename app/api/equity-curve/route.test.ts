import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/equity-curve/get-equity-curve");

import { getEquityCurve } from "@/helpers/equity-curve/get-equity-curve";

import { GET } from "./route";

const mockedGetEquityCurve = vi.mocked(getEquityCurve);

const BASE_URL = "http://test.local/api/equity-curve";

describe("GET /api/equity-curve", () => {
  beforeEach(() => {
    mockedGetEquityCurve.mockReset();
  });

  it("returns 500 when equity curve load fails", async () => {
    mockedGetEquityCurve.mockRejectedValue(new Error("db error"));

    const response = await GET(new Request(BASE_URL));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load equity curve",
    });
  });

  it("returns 200 with equity curve payload", async () => {
    const payload: Awaited<ReturnType<typeof getEquityCurve>> = {
      snapshots: [
        {
          id: 1,
          ts: "2024-01-01T00:00:00.000Z",
          cash: 1000,
          equity: 1000,
          interval: "H1",
        },
      ],
    };
    mockedGetEquityCurve.mockResolvedValue(payload);

    const response = await GET(new Request(`${BASE_URL}?limit=100`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mockedGetEquityCurve).toHaveBeenCalledWith({ limit: 100 });
  });
});
