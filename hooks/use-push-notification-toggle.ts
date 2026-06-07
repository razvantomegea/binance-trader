import { useCallback, useEffect, useState } from "react";

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  type PushState,
} from "@/utils/notifications/push-client";

interface PushToggleResult {
  state: PushState;
  message: string | null;
  pending: boolean;
  isEnabled: boolean;
  refreshState: () => Promise<void>;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

export function usePushNotificationToggle(): PushToggleResult {
  const [state, setState] = useState<PushState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refreshState = useCallback(async () => {
    const status = await getPushStatus();
    setState(status.state);
    setMessage(status.message);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) {
        await refreshState();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshState]);

  const enablePush = useCallback(async () => {
    setPending(true);
    setMessage(null);
    const status = await enablePushNotifications();
    setState(status.state);
    setMessage(status.message);
    setPending(false);
  }, []);

  const disablePush = useCallback(async () => {
    setPending(true);
    setMessage(null);
    const status = await disablePushNotifications();
    setState(status.state);
    setMessage(status.message);
    setPending(false);
  }, []);

  return {
    state,
    message,
    pending,
    isEnabled: state === "enabled",
    refreshState,
    enablePush,
    disablePush,
  };
}
