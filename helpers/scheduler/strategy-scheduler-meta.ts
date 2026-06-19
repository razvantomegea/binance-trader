import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { withDbRetry } from "@/db/with-db-retry";
import { strategyMeta } from "@/db/schema";
import type { RunStrategyResult } from "@/helpers/strategy/strategy-runner";

const RUNNING_KEY = "scheduler_running";
const STARTED_AT_KEY = "scheduler_started_at";
const LAST_RUN_AT_KEY = "scheduler_last_run_at";
const LAST_ERROR_KEY = "scheduler_last_error";
const LAST_RESULT_KEY = "scheduler_last_result";

const SCHEDULER_META_KEYS = [
  RUNNING_KEY,
  STARTED_AT_KEY,
  LAST_RUN_AT_KEY,
  LAST_ERROR_KEY,
  LAST_RESULT_KEY,
] as const;

async function getMetaValues(
  keys: readonly string[],
): Promise<Map<string, string>> {
  if (keys.length === 0) {
    return new Map();
  }

  const rows = await withDbRetry(() =>
    getDb()
      .select()
      .from(strategyMeta)
      .where(inArray(strategyMeta.key, [...keys])),
  );

  return new Map(rows.map((row) => [row.key, row.value]));
}

async function getMetaValue(key: string): Promise<string | null> {
  const [row] = await withDbRetry(() =>
    getDb()
      .select()
      .from(strategyMeta)
      .where(eq(strategyMeta.key, key))
      .limit(1),
  );

  return row?.value ?? null;
}

async function setMetaValue(key: string, value: string): Promise<void> {
  await withDbRetry(() =>
    getDb().insert(strategyMeta).values({ key, value }).onConflictDoUpdate({
      target: strategyMeta.key,
      set: { value },
    }),
  );
}

export function isServerlessScheduler(): boolean {
  return process.env.SCHEDULER_MODE === "external-cron";
}

function normalizeMetaString(value: string | null): string | null {
  if (value === "") {
    return null;
  }
  return value ?? null;
}

export async function getSchedulerRunning(): Promise<boolean> {
  const value = await getMetaValue(RUNNING_KEY);
  if (value === null) {
    return false;
  }
  return value === "true";
}

export async function setSchedulerRunning(running: boolean): Promise<void> {
  await setMetaValue(RUNNING_KEY, running ? "true" : "false");
  if (running) {
    await setMetaValue(STARTED_AT_KEY, String(Date.now()));
  }
}

export async function recordSchedulerRun({
  result,
  error,
}: {
  result?: RunStrategyResult;
  error?: string;
}): Promise<void> {
  await setMetaValue(LAST_RUN_AT_KEY, String(Date.now()));
  await setMetaValue(LAST_ERROR_KEY, error ?? "");
  if (result) {
    await setMetaValue(LAST_RESULT_KEY, JSON.stringify(result));
  }
}

export async function getSchedulerPersistedStatus(): Promise<{
  running: boolean;
  startedAtMs: number | null;
  lastRunAtMs: number | null;
  lastError: string | null;
  lastResult: RunStrategyResult | null;
}> {
  const meta = await getMetaValues(SCHEDULER_META_KEYS);
  const running = meta.get(RUNNING_KEY) === "true";
  const startedAtRaw = meta.get(STARTED_AT_KEY) ?? null;
  const lastRunAtRaw = meta.get(LAST_RUN_AT_KEY) ?? null;
  const lastErrorRaw = meta.get(LAST_ERROR_KEY) ?? null;
  const lastResultRaw = meta.get(LAST_RESULT_KEY) ?? null;

  const startedAtMs = startedAtRaw ? Number(startedAtRaw) : null;
  const lastRunAtMs = lastRunAtRaw ? Number(lastRunAtRaw) : null;

  let lastResult: RunStrategyResult | null = null;
  if (lastResultRaw) {
    try {
      lastResult = JSON.parse(lastResultRaw) as RunStrategyResult;
    } catch {
      lastResult = null;
    }
  }

  return {
    running,
    startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : null,
    lastRunAtMs: Number.isFinite(lastRunAtMs) ? lastRunAtMs : null,
    lastError: normalizeMetaString(lastErrorRaw),
    lastResult,
  };
}
