"use client";

import { useCallback, useEffect, useState } from "react";

import { urlBase64ToUint8Array } from "@/utils/notifications/url-base64-to-uint8array";

type PushState = "unsupported" | "loading" | "disabled" | "enabled" | "error";

function getBrowserSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  return registration.pushManager.getSubscription();
}

async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return String(err);
}

async function readErrorResponseBody(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: unknown;
      details?: unknown;
    };
    const error = typeof data.error === "string" ? data.error : null;
    const details = typeof data.details === "string" ? data.details : null;
    return [error, details].filter(Boolean).join(" | ");
  } catch {
    return "";
  }
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
      const registration = await getActiveServiceWorkerRegistration();
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
    let step = "request-notification-permission";

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("disabled");
        setMessage("Notification permission denied");
        return;
      }

      step = "fetch-vapid-public-key";
      const vapidRes = await fetch("/api/push/vapid-public-key");
      if (!vapidRes.ok) {
        const errorBody = await readErrorResponseBody(vapidRes);
        console.error("[push-enable] vapid-public-key failed", {
          status: vapidRes.status,
          errorBody,
        });
        setState("error");
        setMessage("Push is not configured on server");
        return;
      }

      step = "register-service-worker";
      const { publicKey } = (await vapidRes.json()) as { publicKey: string };
      const registration = await getActiveServiceWorkerRegistration();

      step = "get-or-create-subscription";
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

      step = "save-subscription";
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });

      if (!saveRes.ok) {
        const errorBody = await readErrorResponseBody(saveRes);
        throw new Error(
          `Failed to save subscription (status ${saveRes.status}${
            errorBody ? `: ${errorBody}` : ""
          })`,
        );
      }

      setState("enabled");
      setMessage(null);
    } catch (err) {
      console.error("[push-enable] failed", {
        step,
        error: getErrorMessage(err),
      });
      setState("error");
      setMessage("Failed to enable push notifications");
    } finally {
      setPending(false);
    }
  };

  const disablePush = async () => {
    setPending(true);
    setMessage(null);
    let step = "register-service-worker";

    try {
      const registration = await getActiveServiceWorkerRegistration();
      const subscription = await getBrowserSubscription(registration);

      if (subscription) {
        step = "remove-subscription-on-server";
        const endpoint = subscription.endpoint;
        const removeRes = await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        if (!removeRes.ok) {
          const errorBody = await readErrorResponseBody(removeRes);
          throw new Error(
            `Failed to remove subscription (status ${removeRes.status}${
              errorBody ? `: ${errorBody}` : ""
            })`,
          );
        }
        step = "unsubscribe-browser";
        await subscription.unsubscribe();
      }

      setState("disabled");
      setMessage(null);
    } catch (err) {
      console.error("[push-disable] failed", {
        step,
        error: getErrorMessage(err),
      });
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
