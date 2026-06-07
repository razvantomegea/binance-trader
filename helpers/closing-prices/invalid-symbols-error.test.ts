import { describe, expect, it } from "vitest";

import { InvalidSymbolsError } from "./invalid-symbols-error";

describe("InvalidSymbolsError", () => {
  it("stores invalid symbols and formats message", () => {
    const error = new InvalidSymbolsError(["FOO", "BAR"]);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidSymbolsError");
    expect(error.symbols).toEqual(["FOO", "BAR"]);
    expect(error.message).toBe("Unknown or inactive symbols: FOO, BAR");
  });
});
