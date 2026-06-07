import { readFile, writeFile } from "node:fs/promises";

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  const raw = await readFile(filePath, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line) => JSON.parse(line) as T);
}

export async function writeJsonl<T>(
  filePath: string,
  rows: T[],
): Promise<void> {
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(filePath, content.length > 0 ? `${content}\n` : "", "utf8");
}
