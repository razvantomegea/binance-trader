import { startStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";

export function startCron(): void {
  startStrategyHeartbeat();
}
