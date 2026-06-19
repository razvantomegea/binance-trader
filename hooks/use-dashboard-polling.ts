import { useEffect } from "react";

import { DASHBOARD_POLL_MS } from "@/constants/dashboard";

export function useDashboardPolling(refresh: () => Promise<void>): void {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled || document.hidden) {
        return;
      }
      try {
        await refresh();
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard polling refresh failed:", error);
        }
      }
    };

    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      if (cancelled || document.hidden) {
        return;
      }
      timer = setInterval(() => {
        void tick();
      }, DASHBOARD_POLL_MS);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      void tick();
      startPolling();
    };

    startPolling();
    const initial = setTimeout(() => {
      void tick();
    }, 0);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);
}
