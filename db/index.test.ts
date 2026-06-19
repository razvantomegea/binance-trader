import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb, resetDbInstanceForTests } from "@/db";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: vi.fn(() => ({ mocked: true })),
}));

describe("getDb", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    resetDbInstanceForTests();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    resetDbInstanceForTests();
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("throws when DATABASE_URL is not set", () => {
    expect(() => getDb()).toThrow("DATABASE_URL is not set");
  });

  it("returns singleton db instance when DATABASE_URL is set", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    const first = getDb();
    const second = getDb();
    expect(first).toBe(second);
    expect(first).toEqual({ mocked: true });
  });
});
