import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: vi.fn(() => ({ mocked: true })),
}));

describe("getDb", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    vi.resetModules();
  });

  it("throws when DATABASE_URL is not set", async () => {
    const { getDb } = await import("@/db");
    expect(() => getDb()).toThrow("DATABASE_URL is not set");
  });

  it("returns singleton db instance when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    const { getDb } = await import("@/db");
    const first = getDb();
    const second = getDb();
    expect(first).toBe(second);
    expect(first).toEqual({ mocked: true });
  });
});
