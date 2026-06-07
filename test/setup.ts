import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "" }),
  Geist_Mono: () => ({ variable: "" }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
