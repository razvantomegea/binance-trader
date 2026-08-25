import { describe, expect, it } from "vitest";

import { computeNextHourlyRunIso } from "./compute-next-hourly-run";

describe("computeNextHourlyRunIso", () => {
  it("returns the next UTC hour from mid-hour", () => {
    expect(
      computeNextHourlyRunIso(Date.parse("2024-06-01T10:15:00.000Z")),
    ).toBe("2024-06-01T11:00:00.000Z");
  });

  it("advances from an exact hour boundary", () => {
    expect(
      computeNextHourlyRunIso(Date.parse("2024-06-01T10:00:00.000Z")),
    ).toBe("2024-06-01T11:00:00.000Z");
  });
});
