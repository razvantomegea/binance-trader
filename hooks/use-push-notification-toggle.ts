import { useCallback, useEffect, useRef, useState } from "react";

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

async function runPushToggleAction(params: {
  cancelledRef: { current: boolean };
  action: () => Promise<{ state: PushState; message: string | null }>;
  setPending: (pending: boolean) => void;
  setState: (state: PushState) => void;
  setMessage: (message: string | null) => void;
}): Promise<void> {
  params.setPending(true);
  params.setMessage(null);
  try {
    const status = await params.action();
    if (params.cancelledRef.current) {
      return;
    }
    params.setState(status.state);
    params.setMessage(status.message);
  } finally {
    if (!params.cancelledRef.current) {
      params.setPending(false);
    }
  }
}

export function usePushNotificationToggle(): PushToggleResult {
  const [state, setState] = useState<PushState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const cancelledRef = useRef(false);

  const refreshState = useCallback(async () => {
    const status = await getPushStatus();
    if (cancelledRef.current) {
      return;
    }
    setState(status.state);
    setMessage(status.message);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void refreshState();

    return () => {
      cancelledRef.current = true;
    };
  }, [refreshState]);

  const enablePush = useCallback(async () => {
    await runPushToggleAction({
      cancelledRef,
      action: enablePushNotifications,
      setPending,
      setState,
      setMessage,
    });
  }, []);

  const disablePush = useCallback(async () => {
    await runPushToggleAction({
      cancelledRef,
      action: disablePushNotifications,
      setPending,
      setState,
      setMessage,
    });
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
