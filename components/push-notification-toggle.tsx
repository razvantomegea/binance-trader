"use client";

import { useCallback, useEffect, useState } from "react";

import { urlBase64ToUint8Array } from "@/utils/notifications/url-base64-to-uint8array";

type PushState = "unsupported" | "loading" | "disabled" | "enabled" | "error";

function getBrowserSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  return registration.pushManager.getSubscription();
}

export function PushNotificationToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refreshState = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await getBrowserSubscription(registration);
      setState(subscription ? "enabled" : "disabled");
      setMessage(null);
    } catch {
      setState("error");
      setMessage("Could not register service worker");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) {
        return;
      }
      await refreshState();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshState]);

  const enablePush = async () => {
    setPending(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("disabled");
        setMessage("Notification permission denied");
        return;
      }

      const vapidRes = await fetch("/api/push/vapid-public-key");
      if (!vapidRes.ok) {
        setState("error");
        setMessage("Push is not configured on server");
        return;
      }

      const { publicKey } = (await vapidRes.json()) as { publicKey: string };
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await getBrowserSubscription(registration);
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            publicKey,
          ) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("Invalid push subscription");
      }

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save subscription");
      }

      setState("enabled");
      setMessage(null);
    } catch {
      setState("error");
      setMessage("Failed to enable push notifications");
    } finally {
      setPending(false);
    }
  };

  const disablePush = async () => {
    setPending(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await getBrowserSubscription(registration);

      if (subscription) {
        const endpoint = subscription.endpoint;
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await subscription.unsubscribe();
      }

      setState("disabled");
      setMessage(null);
    } catch {
      setState("error");
      setMessage("Failed to disable push notifications");
    } finally {
      setPending(false);
    }
  };

  if (state === "unsupported") {
    return (
      <p className="text-xs text-zinc-500">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  const isEnabled = state === "enabled";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void (isEnabled ? disablePush() : enablePush())}
        disabled={pending || state === "loading"}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {pending
          ? "Please wait..."
          : isEnabled
            ? "Disable trade alerts"
            : "Enable trade alerts"}
      </button>
      {message ? <p className="text-xs text-rose-500">{message}</p> : null}
    </div>
  );
}
