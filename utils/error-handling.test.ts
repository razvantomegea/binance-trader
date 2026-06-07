import { describe, expect, it } from "vitest";

import { getErrorDetails } from "./error-handling";

describe("getErrorDetails", () => {
  it("returns message for Error instances", () => {
    expect(getErrorDetails(new Error("boom"))).toBe("boom");
  });

  it("returns stringified value for non-Error values", () => {
    expect(getErrorDetails("plain string")).toBe("plain string");
    expect(getErrorDetails(42)).toBe("42");
    expect(getErrorDetails(null)).toBe("null");
    expect(getErrorDetails(undefined)).toBe("undefined");
  });
});
