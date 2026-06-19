import { startCron } from "@/helpers/scheduler/start-cron";

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.AUTO_START_STRATEGY === "true"
  ) {
    startCron();
  }
}
