/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

import { readJsonl, writeJsonl } from "./read-write-jsonl";

describe("read-write-jsonl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("reads non-empty JSONL lines", async () => {
    mockReadFile.mockResolvedValueOnce('{"a":1}\n\n{"b":2}\n');

    await expect(
      readJsonl<{ a?: number; b?: number }>("/tmp/data.jsonl"),
    ).resolves.toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("writes rows as newline-delimited JSON with trailing newline", async () => {
    await writeJsonl("/tmp/out.jsonl", [{ x: 1 }, { y: 2 }]);

    expect(mockWriteFile).toHaveBeenCalledWith(
      "/tmp/out.jsonl",
      '{"x":1}\n{"y":2}\n',
      "utf8",
    );
  });

  it("writes empty file for empty rows", async () => {
    await writeJsonl("/tmp/empty.jsonl", []);

    expect(mockWriteFile).toHaveBeenCalledWith("/tmp/empty.jsonl", "", "utf8");
  });
});
