import cron from "node-cron";

import { runStrategy } from "@/helpers/strategy/strategy-runner";

declare global {
  var __cronStarted: boolean | undefined;
}

async function safeRun(): Promise<void> {
  try {
    const result = await runStrategy();
    console.info(
      `[cron] H1 done: trades=${result.tradesExecuted} equity=${result.equity.toFixed(2)}`,
    );
  } catch (error) {
    console.error("[cron] H1 failed", error);
  }
}

export function startCron(): void {
  if (globalThis.__cronStarted) {
    return;
  }

  globalThis.__cronStarted = true;

  cron.schedule("0 * * * *", () => {
    void safeRun();
  });

  console.info("[cron] hourly strategy scheduler started (H1)");
}
